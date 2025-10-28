/**
 * Billing Reporter Tests
 *
 * Tests billing report generation and database persistence
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BillingReporter, type ExecutionData } from "./billing-reporter";
import { CostAttributor } from "./cost-attributor";
import type { ToolResult, AgentDecision } from "./types";

// Mock database
jest.mock("../db", () => ({
  default: {
    exec: jest.fn(),
    queryRow: jest.fn(),
    query: jest.fn(),
  },
}));

import database from "../db";

describe("BillingReporter", () => {
  let billingReporter: BillingReporter;
  let mockDatabase: jest.Mocked<typeof database>;

  beforeEach(() => {
    billingReporter = new BillingReporter();
    mockDatabase = database as jest.Mocked<typeof database>;
    jest.clearAllMocks();
  });

  describe("generateReport", () => {
    it("should generate report with zero costs", async () => {
      const executionData: ExecutionData = {
        tokensUsed: 0,
        toolCalls: [],
        decisions: [],
        recursionDepth: 0,
        executionTime: 100,
        status: "COMPLETE",
        phaseResult: "CONTINUE",
        fromCache: false,
      };

      const report = await billingReporter.generateReport(
        "test-correlation-id",
        "test-user",
        executionData
      );

      expect(report.correlationId).toBe("test-correlation-id");
      expect(report.userId).toBe("test-user");
      expect(report.totalCost).toBe(0);
      expect(report.executionTime).toBe(100);
      expect(report.metrics.tokensUsed).toBe(0);
      expect(report.metrics.toolCallsCount).toBe(0);
      expect(report.metrics.llmCallsCount).toBe(0);
      expect(report.metrics.recursionDepth).toBe(0);
    });

    it("should generate report with token costs", async () => {
      const decisions: AgentDecision[] = [
        { actionType: "LLM_CALL", status: "NEXT_STEP" },
        { actionType: "LLM_CALL", status: "NEXT_STEP" },
        { actionType: "FINAL_ANSWER", status: "COMPLETE" },
      ];

      const executionData: ExecutionData = {
        tokensUsed: 1000,
        toolCalls: [],
        decisions,
        recursionDepth: 2,
        executionTime: 500,
        status: "COMPLETE",
        phaseResult: "CONTINUE",
        fromCache: false,
      };

      const report = await billingReporter.generateReport(
        "test-correlation-id",
        "test-user",
        executionData
      );

      expect(report.totalCost).toBe(0.002); // 1000 * 0.000002
      expect(report.metrics.tokensUsed).toBe(1000);
      expect(report.metrics.llmCallsCount).toBe(2);
      expect(report.costBreakdown.tokenCost).toBe(0.002);
      expect(report.costBreakdown.toolCost).toBe(0);
    });

    it("should generate report with tool costs", async () => {
      const toolCalls: ToolResult[] = [
        { toolName: "google_search", result: "result1" },
        { toolName: "code_executor", result: "result2" },
        { toolName: "workflow_orchestrator", result: "result3" },
      ];

      const decisions: AgentDecision[] = [
        { actionType: "TOOL_CALL", status: "COMPLETE", toolName: "google_search" },
        { actionType: "TOOL_CALL", status: "COMPLETE", toolName: "code_executor" },
        {
          actionType: "TOOL_CALL",
          status: "COMPLETE",
          toolName: "workflow_orchestrator",
        },
        { actionType: "FINAL_ANSWER", status: "COMPLETE" },
      ];

      const executionData: ExecutionData = {
        tokensUsed: 0,
        toolCalls,
        decisions,
        recursionDepth: 1,
        executionTime: 1200,
        status: "COMPLETE",
        phaseResult: "CONTINUE",
        fromCache: false,
      };

      const report = await billingReporter.generateReport(
        "test-correlation-id",
        "test-user",
        executionData
      );

      expect(report.totalCost).toBe(0.015); // 3 * 0.005
      expect(report.metrics.toolCallsCount).toBe(3);
      expect(report.costBreakdown.toolCost).toBe(0.015);
      expect(report.costBreakdown.tokenCost).toBe(0);
    });

    it("should generate report with combined costs", async () => {
      const toolCalls: ToolResult[] = [
        { toolName: "google_search", result: "result1" },
      ];

      const decisions: AgentDecision[] = [
        { actionType: "LLM_CALL", status: "NEXT_STEP" },
        { actionType: "TOOL_CALL", status: "COMPLETE", toolName: "google_search" },
        { actionType: "LLM_CALL", status: "NEXT_STEP" },
        { actionType: "FINAL_ANSWER", status: "COMPLETE" },
      ];

      const executionData: ExecutionData = {
        tokensUsed: 5000,
        toolCalls,
        decisions,
        recursionDepth: 2,
        executionTime: 2500,
        status: "COMPLETE",
        phaseResult: "CONTINUE",
        fromCache: false,
      };

      const report = await billingReporter.generateReport(
        "test-correlation-id",
        "test-user",
        executionData
      );

      expect(report.totalCost).toBe(0.015); // (5000 * 0.000002) + (1 * 0.005) = 0.01 + 0.005
      expect(report.metrics.tokensUsed).toBe(5000);
      expect(report.metrics.toolCallsCount).toBe(1);
      expect(report.metrics.llmCallsCount).toBe(2);
      expect(report.metrics.recursionDepth).toBe(2);
      expect(report.costBreakdown.tokenCost).toBe(0.01);
      expect(report.costBreakdown.toolCost).toBe(0.005);
    });

    it("should include timestamp in report", async () => {
      const executionData: ExecutionData = {
        tokensUsed: 100,
        toolCalls: [],
        decisions: [],
        recursionDepth: 0,
        executionTime: 100,
        status: "COMPLETE",
        phaseResult: "CONTINUE",
        fromCache: false,
      };

      const beforeTime = new Date();
      const report = await billingReporter.generateReport(
        "test-correlation-id",
        "test-user",
        executionData
      );
      const afterTime = new Date();

      expect(report.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(report.timestamp.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });
  });

  describe("persistReport", () => {
    it("should persist report to database", async () => {
      mockDatabase.exec.mockResolvedValue(undefined);

      const report = await billingReporter.generateReport(
        "test-correlation-id",
        "test-user",
        {
          tokensUsed: 1000,
          toolCalls: [],
          decisions: [],
          recursionDepth: 0,
          executionTime: 100,
          status: "COMPLETE",
          phaseResult: "CONTINUE",
          fromCache: false,
        }
      );

      await billingReporter.persistReport(report, "test-signature", {
        tokensUsed: 1000,
        toolCalls: [],
        decisions: [],
        recursionDepth: 0,
        executionTime: 100,
        status: "COMPLETE",
        phaseResult: "CONTINUE",
        fromCache: false,
      });

      expect(mockDatabase.exec).toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockDatabase.exec.mockRejectedValue(new Error("Database error"));

      const report = await billingReporter.generateReport(
        "test-correlation-id",
        "test-user",
        {
          tokensUsed: 1000,
          toolCalls: [],
          decisions: [],
          recursionDepth: 0,
          executionTime: 100,
          status: "COMPLETE",
          phaseResult: "CONTINUE",
          fromCache: false,
        }
      );

      await expect(
        billingReporter.persistReport(report, "test-signature", {
          tokensUsed: 1000,
          toolCalls: [],
          decisions: [],
          recursionDepth: 0,
          executionTime: 100,
          status: "COMPLETE",
          phaseResult: "CONTINUE",
          fromCache: false,
        })
      ).rejects.toThrow("Failed to persist billing report");
    });
  });

  describe("getUserCosts", () => {
    it("should return zero costs for user with no executions", async () => {
      mockDatabase.queryRow.mockResolvedValue({
        total_cost: null,
        execution_count: "0",
      });

      const result = await billingReporter.getUserCosts("test-user");

      expect(result.totalCost).toBe(0);
      expect(result.executionCount).toBe(0);
    });

    it("should return costs for user with executions", async () => {
      mockDatabase.queryRow.mockResolvedValue({
        total_cost: "0.025",
        execution_count: "5",
      });

      const result = await billingReporter.getUserCosts("test-user");

      expect(result.totalCost).toBe(0.025);
      expect(result.executionCount).toBe(5);
    });

    it("should handle date range filtering", async () => {
      mockDatabase.queryRow.mockResolvedValue({
        total_cost: "0.015",
        execution_count: "3",
      });

      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-12-31");

      const result = await billingReporter.getUserCosts(
        "test-user",
        fromDate,
        toDate
      );

      expect(result.totalCost).toBe(0.015);
      expect(result.executionCount).toBe(3);
    });

    it("should handle database errors", async () => {
      mockDatabase.queryRow.mockRejectedValue(new Error("Database error"));

      const result = await billingReporter.getUserCosts("test-user");

      expect(result.totalCost).toBe(0);
      expect(result.executionCount).toBe(0);
    });
  });

  describe("getReport", () => {
    it("should retrieve report from database", async () => {
      mockDatabase.queryRow.mockResolvedValue({
        correlation_id: "test-correlation-id",
        user_id: "test-user",
        total_cost: "0.015",
        execution_time_ms: 500,
        tokens_used: 1000,
        tool_calls_count: 2,
        llm_calls_count: 3,
        recursion_depth: 2,
        completed_at: new Date(),
      });

      const report = await billingReporter.getReport(
        "test-correlation-id",
        "test-user"
      );

      expect(report).not.toBeNull();
      expect(report?.correlationId).toBe("test-correlation-id");
      expect(report?.userId).toBe("test-user");
      expect(report?.totalCost).toBe(0.015);
      expect(report?.metrics.tokensUsed).toBe(1000);
      expect(report?.metrics.toolCallsCount).toBe(2);
      expect(report?.metrics.llmCallsCount).toBe(3);
    });

    it("should return null when report not found", async () => {
      mockDatabase.queryRow.mockResolvedValue(null);

      const report = await billingReporter.getReport(
        "unknown-id",
        "test-user"
      );

      expect(report).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDatabase.queryRow.mockRejectedValue(new Error("Database error"));

      const report = await billingReporter.getReport(
        "test-correlation-id",
        "test-user"
      );

      expect(report).toBeNull();
    });
  });

  describe("getUserBillingStats", () => {
    it("should return stats for user", async () => {
      mockDatabase.queryRow.mockResolvedValue({
        total_cost: "0.125",
        total_executions: "10",
        total_tokens: "50000",
        total_tool_calls: "25",
        avg_cost: "0.0125",
        avg_tokens: "5000",
      });

      const stats = await billingReporter.getUserBillingStats("test-user");

      expect(stats.totalCost).toBe(0.125);
      expect(stats.totalExecutions).toBe(10);
      expect(stats.totalTokens).toBe(50000);
      expect(stats.totalToolCalls).toBe(25);
      expect(stats.avgCostPerExecution).toBe(0.0125);
      expect(stats.avgTokensPerExecution).toBe(5000);
    });

    it("should return zero stats for user with no executions", async () => {
      mockDatabase.queryRow.mockResolvedValue({
        total_cost: null,
        total_executions: "0",
        total_tokens: null,
        total_tool_calls: null,
        avg_cost: null,
        avg_tokens: null,
      });

      const stats = await billingReporter.getUserBillingStats("test-user");

      expect(stats.totalCost).toBe(0);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalToolCalls).toBe(0);
      expect(stats.avgCostPerExecution).toBe(0);
      expect(stats.avgTokensPerExecution).toBe(0);
    });

    it("should handle date range filtering", async () => {
      mockDatabase.queryRow.mockResolvedValue({
        total_cost: "0.05",
        total_executions: "5",
        total_tokens: "20000",
        total_tool_calls: "10",
        avg_cost: "0.01",
        avg_tokens: "4000",
      });

      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-12-31");

      const stats = await billingReporter.getUserBillingStats(
        "test-user",
        fromDate,
        toDate
      );

      expect(stats.totalCost).toBe(0.05);
      expect(stats.totalExecutions).toBe(5);
    });

    it("should handle database errors", async () => {
      mockDatabase.queryRow.mockRejectedValue(new Error("Database error"));

      const stats = await billingReporter.getUserBillingStats("test-user");

      expect(stats.totalCost).toBe(0);
      expect(stats.totalExecutions).toBe(0);
    });
  });
});
