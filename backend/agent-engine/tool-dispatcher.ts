/**
 * Tool Dispatcher
 *
 * Routes tool calls to appropriate handlers, tracks execution metrics,
 * calculates costs, and maintains audit trails.
 */
import type { ToolName } from "./types";
import { ToolRegistry } from "./tool-registry";

// Lazy import audit logger to avoid runtime dependency in tests
let auditLoggerInstance: any = null;
let auditLoggerInitialized = false;

function getAuditLogger(): any {
  if (!auditLoggerInitialized) {
    try {
      // Try to import audit logger dynamically
      const { auditLogger } = require("./audit-logger");
      auditLoggerInstance = auditLogger;
    } catch (error) {
      // Audit logger not available (e.g., in test environment without Encore)
      auditLoggerInstance = {
        log: async () => {
          // No-op in test environment
        },
      };
    }
    auditLoggerInitialized = true;
  }
  return auditLoggerInstance;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  toolName: ToolName;
  result: any;
  executionTime: number;
  cost: number;
  error?: string;
}

/**
 * Tool execution metrics
 */
interface ExecutionMetrics {
  totalExecutions: number;
  totalCost: number;
  totalTime: number;
  errorCount: number;
  executionsByTool: Map<ToolName, number>;
}

/**
 * Cost configuration
 */
export const TOOL_COST_CONFIG = {
  BASE_COST_PER_CALL: 0.005, // $0.005 per tool call
};

/**
 * ToolDispatcher - orchestrates tool execution
 */
export class ToolDispatcher {
  private metrics: ExecutionMetrics;

  constructor(private registry: ToolRegistry) {
    this.metrics = {
      totalExecutions: 0,
      totalCost: 0,
      totalTime: 0,
      errorCount: 0,
      executionsByTool: new Map(),
    };
  }

  /**
   * Dispatch a tool call
   *
   * @param toolName - Name of tool to execute
   * @param args - Tool arguments
   * @param context - Execution context (userId, correlationId)
   * @returns Tool execution result
   */
  async dispatch(
    toolName: ToolName,
    args: any,
    context?: { userId?: string; correlationId?: string }
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Log tool call start
      if (context?.userId && context?.correlationId) {
        await getAuditLogger().log({
          correlationId: context.correlationId,
          userId: context.userId,
          phase: "TOOL_EXECUTION",
          event: "TOOL_CALL_START",
          details: {
            toolName,
            args,
          },
        });
      }

      // 1. Look up tool in registry
      const tool = this.registry.get(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found in registry`);
      }

      // 2. Validate arguments
      const isValid = this.registry.validate(toolName, args);
      if (!isValid) {
        const errors = this.registry.getValidationErrors(toolName, args);
        throw new Error(
          `Invalid arguments for tool ${toolName}: ${JSON.stringify(errors)}`
        );
      }

      // 3. Execute tool (track time)
      const result = await tool.execute(args);
      const executionTime = Date.now() - startTime;

      // 4. Calculate cost
      const cost = this.calculateCost(toolName, executionTime);

      // 5. Update metrics
      this.updateMetrics(toolName, executionTime, cost, false);

      // 6. Log to audit trail
      if (context?.userId && context?.correlationId) {
        await getAuditLogger().log({
          correlationId: context.correlationId,
          userId: context.userId,
          phase: "TOOL_EXECUTION",
          event: "TOOL_CALL_SUCCESS",
          details: {
            toolName,
            executionTime,
            cost,
            resultPreview: this.truncateResult(result),
          },
        });
      }

      // 7. Return result
      return {
        toolName,
        result,
        executionTime,
        cost,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const cost = this.calculateCost(toolName, executionTime);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update metrics for error
      this.updateMetrics(toolName, executionTime, cost, true);

      // Log error to audit trail
      if (context?.userId && context?.correlationId) {
        await getAuditLogger().log({
          correlationId: context.correlationId,
          userId: context.userId,
          phase: "TOOL_EXECUTION",
          event: "TOOL_CALL_ERROR",
          details: {
            toolName,
            error: errorMessage,
            executionTime,
            cost,
          },
        });
      }

      return {
        toolName,
        result: null,
        executionTime,
        cost,
        error: errorMessage,
      };
    }
  }

  /**
   * Dispatch multiple tools in parallel
   *
   * @param calls - Array of tool calls
   * @param context - Execution context
   * @returns Array of tool execution results
   */
  async dispatchBatch(
    calls: Array<{ toolName: ToolName; args: any }>,
    context?: { userId?: string; correlationId?: string }
  ): Promise<ToolExecutionResult[]> {
    // Execute all tools in parallel
    const promises = calls.map((call) =>
      this.dispatch(call.toolName, call.args, context)
    );

    return Promise.all(promises);
  }

  /**
   * Calculate cost for tool execution
   *
   * @param toolName - Tool name
   * @param executionTime - Execution time in milliseconds
   * @returns Cost in dollars
   */
  private calculateCost(toolName: ToolName, executionTime: number): number {
    // Base cost per tool call
    let cost = TOOL_COST_CONFIG.BASE_COST_PER_CALL;

    // Add time-based cost for long-running tools
    if (executionTime > 1000) {
      // Add $0.001 per second over 1 second
      const extraSeconds = (executionTime - 1000) / 1000;
      cost += extraSeconds * 0.001;
    }

    // Tool-specific cost modifiers
    const costModifiers: Partial<Record<ToolName, number>> = {
      workflow_orchestrator: 1.5, // 50% more expensive
      code_executor: 1.2, // 20% more expensive
      submit_parallel_job: 2.0, // 2x more expensive
      google_search: 1.0,
      retrieve_context: 0.8, // 20% cheaper
    };

    const modifier = costModifiers[toolName] || 1.0;
    cost *= modifier;

    // Round to 6 decimal places
    return Math.round(cost * 1000000) / 1000000;
  }

  /**
   * Update execution metrics
   */
  private updateMetrics(
    toolName: ToolName,
    executionTime: number,
    cost: number,
    isError: boolean
  ): void {
    this.metrics.totalExecutions++;
    this.metrics.totalCost += cost;
    this.metrics.totalTime += executionTime;

    if (isError) {
      this.metrics.errorCount++;
    }

    const toolCount = this.metrics.executionsByTool.get(toolName) || 0;
    this.metrics.executionsByTool.set(toolName, toolCount + 1);
  }

  /**
   * Truncate result for logging (avoid huge logs)
   */
  private truncateResult(result: any): any {
    const stringified = JSON.stringify(result);
    if (stringified.length > 500) {
      return stringified.substring(0, 500) + "... (truncated)";
    }
    return result;
  }

  /**
   * Get execution metrics
   *
   * @returns Current execution metrics
   */
  getMetrics(): {
    totalExecutions: number;
    totalCost: number;
    totalTime: number;
    errorCount: number;
    errorRate: number;
    averageExecutionTime: number;
    executionsByTool: Record<string, number>;
  } {
    const errorRate =
      this.metrics.totalExecutions > 0
        ? this.metrics.errorCount / this.metrics.totalExecutions
        : 0;

    const averageExecutionTime =
      this.metrics.totalExecutions > 0
        ? this.metrics.totalTime / this.metrics.totalExecutions
        : 0;

    const executionsByTool: Record<string, number> = {};
    this.metrics.executionsByTool.forEach((count, toolName) => {
      executionsByTool[toolName] = count;
    });

    return {
      totalExecutions: this.metrics.totalExecutions,
      totalCost: this.metrics.totalCost,
      totalTime: this.metrics.totalTime,
      errorCount: this.metrics.errorCount,
      errorRate,
      averageExecutionTime,
      executionsByTool,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalExecutions: 0,
      totalCost: 0,
      totalTime: 0,
      errorCount: 0,
      executionsByTool: new Map(),
    };
  }

  /**
   * Get cost estimate for a tool call
   *
   * @param toolName - Tool name
   * @param estimatedTime - Estimated execution time (optional)
   * @returns Estimated cost
   */
  estimateCost(toolName: ToolName, estimatedTime: number = 500): number {
    return this.calculateCost(toolName, estimatedTime);
  }
}

/**
 * Create dispatcher with default registry
 */
export function createToolDispatcher(registry: ToolRegistry): ToolDispatcher {
  return new ToolDispatcher(registry);
}
