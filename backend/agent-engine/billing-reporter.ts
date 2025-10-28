/**
 * Billing Reporter
 *
 * Generates and persists billing reports for agent executions.
 * Stores reports in agent_execution_metadata table for billing and analytics.
 */
import database from "../db";
import type { CostBreakdown } from "./cost-attributor";
import { CostAttributor } from "./cost-attributor";
import type { ToolResult, AgentDecision } from "./types";

/**
 * Billing report structure
 */
export interface BillingReport {
  correlationId: string;
  userId: string;
  totalCost: number;
  costBreakdown: CostBreakdown;
  executionTime: number;
  timestamp: Date;

  // Detailed metrics
  metrics: {
    tokensUsed: number;
    toolCallsCount: number;
    llmCallsCount: number;
    recursionDepth: number;
  };
}

/**
 * Execution data for billing report generation
 */
export interface ExecutionData {
  tokensUsed: number;
  toolCalls: ToolResult[];
  decisions: AgentDecision[];
  recursionDepth: number;
  executionTime: number;
  status: string;
  phaseResult: string;
  fromCache: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * User cost summary
 */
export interface UserCostSummary {
  totalCost: number;
  executionCount: number;
}

/**
 * BillingReporter - generates and persists billing reports
 */
export class BillingReporter {
  private costAttributor: CostAttributor;

  constructor(costAttributor?: CostAttributor) {
    this.costAttributor = costAttributor || new CostAttributor();
  }

  /**
   * Generate a complete billing report
   *
   * @param correlationId - Execution correlation ID
   * @param userId - User ID
   * @param execution - Execution data
   * @returns Complete billing report
   */
  async generateReport(
    correlationId: string,
    userId: string,
    execution: ExecutionData
  ): Promise<BillingReport> {
    const { tokensUsed, toolCalls, decisions, recursionDepth, executionTime } =
      execution;

    // Calculate cost breakdown
    const costBreakdown = this.costAttributor.calculateCostBreakdown({
      tokensUsed,
      toolCalls,
      decisions,
    });

    // Count LLM calls
    const llmCallsCount = decisions.filter(
      (d) => d.actionType === "LLM_CALL"
    ).length;

    // Create billing report
    const report: BillingReport = {
      correlationId,
      userId,
      totalCost: costBreakdown.totalCost,
      costBreakdown,
      executionTime,
      timestamp: new Date(),
      metrics: {
        tokensUsed,
        toolCallsCount: toolCalls.length,
        llmCallsCount,
        recursionDepth,
      },
    };

    return report;
  }

  /**
   * Persist billing report to database
   *
   * @param report - Billing report to persist
   * @param intentSignature - Intent signature for linking
   * @param execution - Execution data including status
   */
  async persistReport(
    report: BillingReport,
    intentSignature: string,
    execution: ExecutionData
  ): Promise<void> {
    try {
      // Insert or update execution metadata
      await database.exec`
        INSERT INTO agent_execution_metadata (
          correlation_id,
          intent_signature,
          user_id,
          started_at,
          completed_at,
          status,
          phase_result,
          from_cache,
          execution_time_ms,
          tokens_used,
          total_cost,
          recursion_depth,
          tool_calls_count,
          llm_calls_count,
          error_code,
          error_message
        ) VALUES (
          ${report.correlationId},
          ${intentSignature},
          ${report.userId},
          NOW() - INTERVAL '${report.executionTime} milliseconds',
          NOW(),
          ${execution.status},
          ${execution.phaseResult},
          ${execution.fromCache},
          ${report.executionTime},
          ${report.metrics.tokensUsed},
          ${report.totalCost},
          ${report.metrics.recursionDepth},
          ${report.metrics.toolCallsCount},
          ${report.metrics.llmCallsCount},
          ${execution.error?.code || null},
          ${execution.error?.message || null}
        )
        ON CONFLICT (correlation_id)
        DO UPDATE SET
          completed_at = EXCLUDED.completed_at,
          status = EXCLUDED.status,
          phase_result = EXCLUDED.phase_result,
          execution_time_ms = EXCLUDED.execution_time_ms,
          tokens_used = EXCLUDED.tokens_used,
          total_cost = EXCLUDED.total_cost,
          recursion_depth = EXCLUDED.recursion_depth,
          tool_calls_count = EXCLUDED.tool_calls_count,
          llm_calls_count = EXCLUDED.llm_calls_count,
          error_code = EXCLUDED.error_code,
          error_message = EXCLUDED.error_message
      `;
    } catch (error) {
      console.error("Failed to persist billing report:", {
        correlationId: report.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `Failed to persist billing report: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get total costs for a user over a date range
   *
   * @param userId - User ID
   * @param fromDate - Start date (optional)
   * @param toDate - End date (optional)
   * @returns User cost summary
   */
  async getUserCosts(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<UserCostSummary> {
    try {
      // Build date filter
      const dateFilter = [];
      if (fromDate) {
        dateFilter.push(`started_at >= '${fromDate.toISOString()}'`);
      }
      if (toDate) {
        dateFilter.push(`started_at <= '${toDate.toISOString()}'`);
      }
      const dateClause =
        dateFilter.length > 0 ? `AND ${dateFilter.join(" AND ")}` : "";

      const result = await database.queryRow<{
        total_cost: string | null;
        execution_count: string;
      }>`
        SELECT
          COALESCE(SUM(total_cost), 0) as total_cost,
          COUNT(*) as execution_count
        FROM agent_execution_metadata
        WHERE user_id = ${userId}
          ${dateClause ? `${dateClause}` : ""}
      `;

      if (!result) {
        return {
          totalCost: 0,
          executionCount: 0,
        };
      }

      return {
        totalCost: result.total_cost
          ? Number(parseFloat(result.total_cost).toFixed(6))
          : 0,
        executionCount: Number(result.execution_count),
      };
    } catch (error) {
      console.error("Failed to get user costs:", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalCost: 0,
        executionCount: 0,
      };
    }
  }

  /**
   * Get billing report for a specific execution
   *
   * @param correlationId - Correlation ID
   * @param userId - User ID for access control
   * @returns Billing report or null if not found
   */
  async getReport(
    correlationId: string,
    userId: string
  ): Promise<BillingReport | null> {
    try {
      const result = await database.queryRow<{
        correlation_id: string;
        user_id: string;
        total_cost: string;
        execution_time_ms: number;
        tokens_used: number;
        tool_calls_count: number;
        llm_calls_count: number;
        recursion_depth: number;
        completed_at: Date;
      }>`
        SELECT
          correlation_id,
          user_id,
          total_cost,
          execution_time_ms,
          tokens_used,
          tool_calls_count,
          llm_calls_count,
          recursion_depth,
          completed_at
        FROM agent_execution_metadata
        WHERE correlation_id = ${correlationId}
          AND user_id = ${userId}
      `;

      if (!result) {
        return null;
      }

      // Reconstruct billing report (without full cost breakdown)
      const report: BillingReport = {
        correlationId: result.correlation_id,
        userId: result.user_id,
        totalCost: parseFloat(result.total_cost),
        costBreakdown: {
          tokenCost: this.costAttributor.calculateTokenCost(
            result.tokens_used
          ),
          toolCost: this.costAttributor.calculateToolCost(
            result.tool_calls_count
          ),
          totalCost: parseFloat(result.total_cost),
          breakdown: [],
        },
        executionTime: result.execution_time_ms,
        timestamp: result.completed_at,
        metrics: {
          tokensUsed: result.tokens_used,
          toolCallsCount: result.tool_calls_count,
          llmCallsCount: result.llm_calls_count,
          recursionDepth: result.recursion_depth,
        },
      };

      return report;
    } catch (error) {
      console.error("Failed to get billing report:", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get aggregated billing statistics for a user
   *
   * @param userId - User ID
   * @param fromDate - Start date (optional)
   * @param toDate - End date (optional)
   */
  async getUserBillingStats(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    totalCost: number;
    totalExecutions: number;
    totalTokens: number;
    totalToolCalls: number;
    avgCostPerExecution: number;
    avgTokensPerExecution: number;
  }> {
    try {
      const dateFilter = [];
      if (fromDate) {
        dateFilter.push(`started_at >= '${fromDate.toISOString()}'`);
      }
      if (toDate) {
        dateFilter.push(`started_at <= '${toDate.toISOString()}'`);
      }
      const dateClause =
        dateFilter.length > 0 ? `AND ${dateFilter.join(" AND ")}` : "";

      const result = await database.queryRow<{
        total_cost: string | null;
        total_executions: string;
        total_tokens: string | null;
        total_tool_calls: string | null;
        avg_cost: string | null;
        avg_tokens: string | null;
      }>`
        SELECT
          COALESCE(SUM(total_cost), 0) as total_cost,
          COUNT(*) as total_executions,
          COALESCE(SUM(tokens_used), 0) as total_tokens,
          COALESCE(SUM(tool_calls_count), 0) as total_tool_calls,
          COALESCE(AVG(total_cost), 0) as avg_cost,
          COALESCE(AVG(tokens_used), 0) as avg_tokens
        FROM agent_execution_metadata
        WHERE user_id = ${userId}
          ${dateClause ? `${dateClause}` : ""}
      `;

      if (!result) {
        return {
          totalCost: 0,
          totalExecutions: 0,
          totalTokens: 0,
          totalToolCalls: 0,
          avgCostPerExecution: 0,
          avgTokensPerExecution: 0,
        };
      }

      return {
        totalCost: result.total_cost
          ? Number(parseFloat(result.total_cost).toFixed(6))
          : 0,
        totalExecutions: Number(result.total_executions),
        totalTokens: result.total_tokens ? Number(result.total_tokens) : 0,
        totalToolCalls: result.total_tool_calls
          ? Number(result.total_tool_calls)
          : 0,
        avgCostPerExecution: result.avg_cost
          ? Number(parseFloat(result.avg_cost).toFixed(6))
          : 0,
        avgTokensPerExecution: result.avg_tokens
          ? Math.round(Number(result.avg_tokens))
          : 0,
      };
    } catch (error) {
      console.error("Failed to get user billing stats:", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalCost: 0,
        totalExecutions: 0,
        totalTokens: 0,
        totalToolCalls: 0,
        avgCostPerExecution: 0,
        avgTokensPerExecution: 0,
      };
    }
  }
}

/**
 * Singleton instance
 */
export const billingReporter = new BillingReporter();
