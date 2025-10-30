/**
 * Cost Attributor
 *
 * Handles cost calculation for agent execution including:
 * - Token costs (LLM usage)
 * - Tool call costs
 * - Detailed cost breakdowns by phase
 */
import type { ToolResult, AgentDecision } from "./types";

/**
 * Cost breakdown structure
 */
export interface CostBreakdown {
  tokenCost: number;
  toolCost: number;
  totalCost: number;
  breakdown: {
    phase: string;
    tokens?: number;
    tools?: number;
    cost: number;
  }[];
}

/**
 * Cost calculation input structure
 */
export interface CostCalculationInput {
  tokensUsed: number;
  toolCalls: ToolResult[];
  decisions: AgentDecision[];
}

/**
 * Cost constants from specification
 */
export const COST_CONSTANTS = {
  // Token cost: $0.000002 per token
  TOKEN_COST_PER_UNIT: 0.000002,

  // Tool cost: $0.005 per tool call
  TOOL_COST_PER_CALL: 0.005,
};

/**
 * CostAttributor - handles all cost calculations
 */
export class CostAttributor {
  // Constants from spec
  private readonly TOKEN_COST = COST_CONSTANTS.TOKEN_COST_PER_UNIT;
  private readonly TOOL_COST = COST_CONSTANTS.TOOL_COST_PER_CALL;

  /**
   * Calculate cost for token usage
   *
   * @param tokens - Number of tokens used
   * @returns Token cost in USD
   */
  calculateTokenCost(tokens: number): number {
    if (tokens < 0) {
      throw new Error("Token count cannot be negative");
    }

    // Use precise calculation to avoid floating point errors
    return Number((tokens * this.TOKEN_COST).toFixed(6));
  }

  /**
   * Calculate cost for tool calls
   *
   * @param toolCalls - Number of tool calls made
   * @returns Tool call cost in USD
   */
  calculateToolCost(toolCalls: number): number {
    if (toolCalls < 0) {
      throw new Error("Tool call count cannot be negative");
    }

    // Use precise calculation
    return Number((toolCalls * this.TOOL_COST).toFixed(6));
  }

  /**
   * Calculate total cost for an execution
   *
   * @param tokens - Number of tokens used
   * @param toolCalls - Number of tool calls made
   * @returns Total cost in USD
   */
  calculateTotalCost(tokens: number, toolCalls: number): number {
    const tokenCost = this.calculateTokenCost(tokens);
    const toolCost = this.calculateToolCost(toolCalls);

    return Number((tokenCost + toolCost).toFixed(6));
  }

  /**
   * Calculate detailed cost breakdown by phase
   *
   * @param execution - Execution details including tokens, tools, and decisions
   * @returns Detailed cost breakdown
   */
  calculateCostBreakdown(execution: CostCalculationInput): CostBreakdown {
    const { tokensUsed, toolCalls, decisions } = execution;

    // Calculate base costs
    const tokenCost = this.calculateTokenCost(tokensUsed);
    const toolCost = this.calculateToolCost(toolCalls.length);
    const totalCost = Number((tokenCost + toolCost).toFixed(6));

    // Build breakdown by phase
    const breakdown: CostBreakdown["breakdown"] = [];

    // Phase 1: Ingestion (minimal token usage for validation)
    breakdown.push({
      phase: "INGESTION",
      tokens: 0,
      tools: 0,
      cost: 0,
    });

    // Phase 2: Policy Check (minimal token usage)
    breakdown.push({
      phase: "POLICY",
      tokens: 0,
      tools: 0,
      cost: 0,
    });

    // Phase 3: Execution - Track LLM calls and tool calls
    const llmCallCount = decisions.filter(
      (d) => d.actionType === "LLM_CALL"
    ).length;

    const toolCallCount = toolCalls.length;

    // Estimate token distribution (most tokens used in execution phase)
    const executionTokens = Math.floor(tokensUsed * 0.9);
    const executionTokenCost = this.calculateTokenCost(executionTokens);
    const executionToolCost = this.calculateToolCost(toolCallCount);

    breakdown.push({
      phase: "EXECUTION",
      tokens: executionTokens,
      tools: toolCallCount,
      cost: Number((executionTokenCost + executionToolCost).toFixed(6)),
    });

    // Phase 4: Aggregation (remaining tokens for final answer compilation)
    const aggregationTokens = tokensUsed - executionTokens;
    const aggregationCost = this.calculateTokenCost(aggregationTokens);

    breakdown.push({
      phase: "AGGREGATION",
      tokens: aggregationTokens,
      tools: 0,
      cost: Number(aggregationCost.toFixed(6)),
    });

    // Phase 5: Serialization (no additional costs)
    breakdown.push({
      phase: "SERIALIZATION",
      tokens: 0,
      tools: 0,
      cost: 0,
    });

    return {
      tokenCost,
      toolCost,
      totalCost,
      breakdown,
    };
  }

  /**
   * Calculate cost from tool results that may already have cost information
   *
   * @param toolResults - Array of tool results
   * @returns Total cost from tool results
   */
  calculateToolResultsCost(toolResults: ToolResult[]): number {
    let totalCost = 0;

    for (const tool of toolResults) {
      // Use pre-calculated cost if available, otherwise use default
      if (tool.cost !== undefined) {
        totalCost += tool.cost;
      } else {
        totalCost += this.TOOL_COST;
      }
    }

    return Number(totalCost.toFixed(6));
  }

  /**
   * Estimate token usage based on decisions (for scenarios where exact count isn't available)
   *
   * @param decisions - Array of agent decisions
   * @returns Estimated token count
   */
  estimateTokenUsage(decisions: AgentDecision[]): number {
    let estimatedTokens = 0;

    for (const decision of decisions) {
      // Estimate tokens per decision type
      switch (decision.actionType) {
        case "LLM_CALL":
          // LLM calls typically use 500-1000 tokens (prompt + response)
          estimatedTokens += 750;
          break;
        case "TOOL_CALL":
          // Tool calls use fewer tokens (just the function call)
          estimatedTokens += 100;
          break;
        case "FINAL_ANSWER":
          // Final answer generation
          estimatedTokens += 200;
          break;
      }

      // Add tokens for reasoning if present
      if (decision.reasoning) {
        // Rough estimate: 1 token per 4 characters
        estimatedTokens += Math.ceil(decision.reasoning.length / 4);
      }
    }

    return estimatedTokens;
  }

  /**
   * Validate cost breakdown totals match
   *
   * @param breakdown - Cost breakdown to validate
   * @returns True if breakdown is valid
   */
  validateBreakdown(breakdown: CostBreakdown): boolean {
    // Sum up all phase costs
    const phaseTotalCost = breakdown.breakdown.reduce(
      (sum, phase) => sum + phase.cost,
      0
    );

    // Check if sum matches total (with small floating point tolerance)
    const tolerance = 0.000001;
    const diff = Math.abs(phaseTotalCost - breakdown.totalCost);

    return diff < tolerance;
  }
}

/**
 * Singleton instance
 */
export const costAttributor = new CostAttributor();
