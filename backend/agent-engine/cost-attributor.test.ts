/**
 * Cost Attributor Tests
 *
 * Tests cost calculation accuracy and edge cases
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  CostAttributor,
  COST_CONSTANTS,
  type CostBreakdown,
} from "./cost-attributor";
import type { ToolResult, AgentDecision } from "./types";

describe("CostAttributor", () => {
  let costAttributor: CostAttributor;

  beforeEach(() => {
    costAttributor = new CostAttributor();
  });

  describe("calculateTokenCost", () => {
    it("should calculate cost for zero tokens", () => {
      const cost = costAttributor.calculateTokenCost(0);
      expect(cost).toBe(0);
    });

    it("should calculate cost for single token", () => {
      const cost = costAttributor.calculateTokenCost(1);
      expect(cost).toBe(0.000002);
    });

    it("should calculate cost for 1000 tokens", () => {
      const cost = costAttributor.calculateTokenCost(1000);
      expect(cost).toBe(0.002);
    });

    it("should calculate cost for 10000 tokens", () => {
      const cost = costAttributor.calculateTokenCost(10000);
      expect(cost).toBe(0.02);
    });

    it("should calculate cost for 100000 tokens", () => {
      const cost = costAttributor.calculateTokenCost(100000);
      expect(cost).toBe(0.2);
    });

    it("should maintain precision to 6 decimal places", () => {
      const cost = costAttributor.calculateTokenCost(12345);
      expect(cost).toBe(0.02469);
      expect(cost.toString().split(".")[1]?.length).toBeLessThanOrEqual(6);
    });

    it("should throw error for negative tokens", () => {
      expect(() => costAttributor.calculateTokenCost(-1)).toThrow(
        "Token count cannot be negative"
      );
    });

    it("should handle large numbers accurately", () => {
      const cost = costAttributor.calculateTokenCost(1000000);
      expect(cost).toBe(2.0);
    });
  });

  describe("calculateToolCost", () => {
    it("should calculate cost for zero tool calls", () => {
      const cost = costAttributor.calculateToolCost(0);
      expect(cost).toBe(0);
    });

    it("should calculate cost for single tool call", () => {
      const cost = costAttributor.calculateToolCost(1);
      expect(cost).toBe(0.005);
    });

    it("should calculate cost for 10 tool calls", () => {
      const cost = costAttributor.calculateToolCost(10);
      expect(cost).toBe(0.05);
    });

    it("should calculate cost for 100 tool calls", () => {
      const cost = costAttributor.calculateToolCost(100);
      expect(cost).toBe(0.5);
    });

    it("should maintain precision to 6 decimal places", () => {
      const cost = costAttributor.calculateToolCost(7);
      expect(cost).toBe(0.035);
      expect(cost.toString().split(".")[1]?.length).toBeLessThanOrEqual(6);
    });

    it("should throw error for negative tool calls", () => {
      expect(() => costAttributor.calculateToolCost(-1)).toThrow(
        "Tool call count cannot be negative"
      );
    });
  });

  describe("calculateTotalCost", () => {
    it("should calculate total cost for zero usage", () => {
      const cost = costAttributor.calculateTotalCost(0, 0);
      expect(cost).toBe(0);
    });

    it("should calculate total cost for tokens only", () => {
      const cost = costAttributor.calculateTotalCost(1000, 0);
      expect(cost).toBe(0.002);
    });

    it("should calculate total cost for tools only", () => {
      const cost = costAttributor.calculateTotalCost(0, 5);
      expect(cost).toBe(0.025);
    });

    it("should calculate total cost for both tokens and tools", () => {
      const cost = costAttributor.calculateTotalCost(1000, 5);
      expect(cost).toBe(0.027); // 0.002 + 0.025
    });

    it("should maintain precision for combined costs", () => {
      const cost = costAttributor.calculateTotalCost(12345, 7);
      // 12345 * 0.000002 = 0.02469
      // 7 * 0.005 = 0.035
      // Total = 0.05969
      expect(cost).toBe(0.05969);
    });

    it("should calculate accurately for large numbers", () => {
      const cost = costAttributor.calculateTotalCost(100000, 100);
      // 100000 * 0.000002 = 0.2
      // 100 * 0.005 = 0.5
      // Total = 0.7
      expect(cost).toBe(0.7);
    });
  });

  describe("calculateCostBreakdown", () => {
    it("should calculate breakdown for execution with no usage", () => {
      const breakdown = costAttributor.calculateCostBreakdown({
        tokensUsed: 0,
        toolCalls: [],
        decisions: [],
      });

      expect(breakdown.tokenCost).toBe(0);
      expect(breakdown.toolCost).toBe(0);
      expect(breakdown.totalCost).toBe(0);
      expect(breakdown.breakdown).toHaveLength(5); // 5 phases
    });

    it("should calculate breakdown for execution with tokens only", () => {
      const decisions: AgentDecision[] = [
        {
          actionType: "LLM_CALL",
          status: "COMPLETE",
          nextPrompt: "test",
        },
        {
          actionType: "FINAL_ANSWER",
          status: "COMPLETE",
          finalAnswer: "result",
        },
      ];

      const breakdown = costAttributor.calculateCostBreakdown({
        tokensUsed: 1000,
        toolCalls: [],
        decisions,
      });

      expect(breakdown.tokenCost).toBe(0.002);
      expect(breakdown.toolCost).toBe(0);
      expect(breakdown.totalCost).toBe(0.002);
    });

    it("should calculate breakdown for execution with tools only", () => {
      const toolCalls: ToolResult[] = [
        { toolName: "google_search", result: "result1" },
        { toolName: "code_executor", result: "result2" },
      ];

      const decisions: AgentDecision[] = [
        {
          actionType: "TOOL_CALL",
          status: "COMPLETE",
          toolName: "google_search",
        },
        {
          actionType: "TOOL_CALL",
          status: "COMPLETE",
          toolName: "code_executor",
        },
      ];

      const breakdown = costAttributor.calculateCostBreakdown({
        tokensUsed: 0,
        toolCalls,
        decisions,
      });

      expect(breakdown.tokenCost).toBe(0);
      expect(breakdown.toolCost).toBe(0.01);
      expect(breakdown.totalCost).toBe(0.01);
    });

    it("should calculate breakdown for full execution", () => {
      const toolCalls: ToolResult[] = [
        { toolName: "google_search", result: "result1" },
        { toolName: "code_executor", result: "result2" },
      ];

      const decisions: AgentDecision[] = [
        {
          actionType: "LLM_CALL",
          status: "NEXT_STEP",
          nextPrompt: "analyze",
        },
        {
          actionType: "TOOL_CALL",
          status: "TOOL_DISPATCHED",
          toolName: "google_search",
        },
        {
          actionType: "TOOL_CALL",
          status: "TOOL_DISPATCHED",
          toolName: "code_executor",
        },
        {
          actionType: "FINAL_ANSWER",
          status: "COMPLETE",
          finalAnswer: "final result",
        },
      ];

      const breakdown = costAttributor.calculateCostBreakdown({
        tokensUsed: 5000,
        toolCalls,
        decisions,
      });

      expect(breakdown.tokenCost).toBe(0.01); // 5000 * 0.000002
      expect(breakdown.toolCost).toBe(0.01); // 2 * 0.005
      expect(breakdown.totalCost).toBe(0.02); // 0.01 + 0.01
      expect(breakdown.breakdown).toHaveLength(5);

      // Verify all phases are included
      const phaseNames = breakdown.breakdown.map((p) => p.phase);
      expect(phaseNames).toContain("INGESTION");
      expect(phaseNames).toContain("POLICY");
      expect(phaseNames).toContain("EXECUTION");
      expect(phaseNames).toContain("AGGREGATION");
      expect(phaseNames).toContain("SERIALIZATION");
    });

    it("should distribute costs across phases", () => {
      const breakdown = costAttributor.calculateCostBreakdown({
        tokensUsed: 1000,
        toolCalls: [{ toolName: "google_search", result: "test" }],
        decisions: [
          { actionType: "LLM_CALL", status: "NEXT_STEP" },
          { actionType: "TOOL_CALL", status: "COMPLETE", toolName: "google_search" },
          { actionType: "FINAL_ANSWER", status: "COMPLETE" },
        ],
      });

      // Execution phase should have most of the cost
      const executionPhase = breakdown.breakdown.find(
        (p) => p.phase === "EXECUTION"
      );
      expect(executionPhase).toBeDefined();
      expect(executionPhase!.cost).toBeGreaterThan(0);
      expect(executionPhase!.tools).toBe(1);

      // Aggregation phase should have some token cost
      const aggregationPhase = breakdown.breakdown.find(
        (p) => p.phase === "AGGREGATION"
      );
      expect(aggregationPhase).toBeDefined();
      expect(aggregationPhase!.cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateToolResultsCost", () => {
    it("should calculate cost when tools have pre-calculated costs", () => {
      const toolResults: ToolResult[] = [
        { toolName: "google_search", result: "test", cost: 0.007 },
        { toolName: "code_executor", result: "test", cost: 0.003 },
      ];

      const cost = costAttributor.calculateToolResultsCost(toolResults);
      expect(cost).toBe(0.01);
    });

    it("should use default cost when not provided", () => {
      const toolResults: ToolResult[] = [
        { toolName: "google_search", result: "test" },
        { toolName: "code_executor", result: "test" },
      ];

      const cost = costAttributor.calculateToolResultsCost(toolResults);
      expect(cost).toBe(0.01); // 2 * 0.005
    });

    it("should handle mix of pre-calculated and default costs", () => {
      const toolResults: ToolResult[] = [
        { toolName: "google_search", result: "test", cost: 0.007 },
        { toolName: "code_executor", result: "test" }, // Uses default 0.005
      ];

      const cost = costAttributor.calculateToolResultsCost(toolResults);
      expect(cost).toBe(0.012);
    });
  });

  describe("estimateTokenUsage", () => {
    it("should estimate tokens for LLM calls", () => {
      const decisions: AgentDecision[] = [
        { actionType: "LLM_CALL", status: "NEXT_STEP" },
        { actionType: "LLM_CALL", status: "NEXT_STEP" },
      ];

      const tokens = costAttributor.estimateTokenUsage(decisions);
      expect(tokens).toBe(1500); // 2 * 750
    });

    it("should estimate tokens for tool calls", () => {
      const decisions: AgentDecision[] = [
        { actionType: "TOOL_CALL", status: "COMPLETE", toolName: "google_search" },
        { actionType: "TOOL_CALL", status: "COMPLETE", toolName: "code_executor" },
      ];

      const tokens = costAttributor.estimateTokenUsage(decisions);
      expect(tokens).toBe(200); // 2 * 100
    });

    it("should estimate tokens for final answer", () => {
      const decisions: AgentDecision[] = [
        { actionType: "FINAL_ANSWER", status: "COMPLETE", finalAnswer: "result" },
      ];

      const tokens = costAttributor.estimateTokenUsage(decisions);
      expect(tokens).toBe(200);
    });

    it("should include reasoning tokens", () => {
      const decisions: AgentDecision[] = [
        {
          actionType: "LLM_CALL",
          status: "NEXT_STEP",
          reasoning: "This is a test reasoning with about 100 characters to see how tokens are estimated correctly here.",
        },
      ];

      const tokens = costAttributor.estimateTokenUsage(decisions);
      // 750 (base) + ~25 (reasoning chars / 4)
      expect(tokens).toBeGreaterThan(750);
      expect(tokens).toBeLessThan(800);
    });
  });

  describe("validateBreakdown", () => {
    it("should validate correct breakdown", () => {
      const breakdown = costAttributor.calculateCostBreakdown({
        tokensUsed: 1000,
        toolCalls: [{ toolName: "google_search", result: "test" }],
        decisions: [],
      });

      const isValid = costAttributor.validateBreakdown(breakdown);
      expect(isValid).toBe(true);
    });

    it("should reject invalid breakdown", () => {
      const breakdown: CostBreakdown = {
        tokenCost: 0.002,
        toolCost: 0.005,
        totalCost: 0.01, // Should be 0.007
        breakdown: [],
      };

      const isValid = costAttributor.validateBreakdown(breakdown);
      expect(isValid).toBe(false);
    });
  });

  describe("Cost Constants", () => {
    it("should have correct token cost constant", () => {
      expect(COST_CONSTANTS.TOKEN_COST_PER_UNIT).toBe(0.000002);
    });

    it("should have correct tool cost constant", () => {
      expect(COST_CONSTANTS.TOOL_COST_PER_CALL).toBe(0.005);
    });
  });
});
