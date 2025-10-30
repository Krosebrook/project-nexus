/**
 * Tool Dispatcher Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { ToolDispatcher, TOOL_COST_CONFIG } from "./tool-dispatcher";
import { ToolRegistry } from "./tool-registry";
import type { ToolDefinition } from "./tool-registry";
import type { ToolName } from "./types";

describe("ToolDispatcher", () => {
  let registry: ToolRegistry;
  let dispatcher: ToolDispatcher;

  beforeEach(() => {
    registry = new ToolRegistry();
    dispatcher = new ToolDispatcher(registry);
    dispatcher.resetMetrics();
  });

  const registerMockTool = (
    name: ToolName,
    executeFn?: (args: any) => Promise<any>
  ) => {
    const tool: ToolDefinition = {
      name,
      description: `Mock ${name} tool`,
      inputSchema: z.object({ query: z.string().optional() }),
      execute: executeFn || (async (args) => ({ success: true, args })),
    };
    registry.register(tool);
  };

  describe("dispatch", () => {
    it("should successfully dispatch a tool call", async () => {
      registerMockTool("google_search");

      const result = await dispatcher.dispatch("google_search", {
        query: "test",
      });

      expect(result.toolName).toBe("google_search");
      expect(result.result).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.cost).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it("should return error for non-existent tool", async () => {
      const result = await dispatcher.dispatch("google_search", {});

      expect(result.error).toContain("not found in registry");
      expect(result.result).toBeNull();
    });

    it("should validate tool arguments", async () => {
      const tool: ToolDefinition = {
        name: "google_search",
        description: "Search",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().optional(),
        }),
        execute: async (args) => ({ results: [] }),
      };
      registry.register(tool);

      const result = await dispatcher.dispatch("google_search", {
        limit: "invalid", // should be number
      });

      expect(result.error).toContain("Invalid arguments");
    });

    it("should calculate cost correctly", async () => {
      registerMockTool("google_search");

      const result = await dispatcher.dispatch("google_search", {
        query: "test",
      });

      expect(result.cost).toBeGreaterThanOrEqual(TOOL_COST_CONFIG.BASE_COST_PER_CALL);
    });

    it("should track execution time", async () => {
      registerMockTool("google_search", async (args) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { results: [] };
      });

      const result = await dispatcher.dispatch("google_search", {
        query: "test",
      });

      expect(result.executionTime).toBeGreaterThan(50);
    });

    it("should handle tool execution errors", async () => {
      registerMockTool("google_search", async (args) => {
        throw new Error("Tool execution failed");
      });

      const result = await dispatcher.dispatch("google_search", {
        query: "test",
      });

      expect(result.error).toBe("Tool execution failed");
      expect(result.result).toBeNull();
    });

    it("should pass context for audit logging", async () => {
      registerMockTool("google_search");

      const result = await dispatcher.dispatch(
        "google_search",
        { query: "test" },
        {
          userId: "user123",
          correlationId: "corr123",
        }
      );

      expect(result.toolName).toBe("google_search");
      expect(result.error).toBeUndefined();
    });
  });

  describe("dispatchBatch", () => {
    it("should dispatch multiple tools in parallel", async () => {
      registerMockTool("google_search");
      registerMockTool("retrieve_context");

      const calls = [
        { toolName: "google_search" as ToolName, args: { query: "test1" } },
        { toolName: "retrieve_context" as ToolName, args: { query: "test2" } },
      ];

      const results = await dispatcher.dispatchBatch(calls);

      expect(results).toHaveLength(2);
      expect(results[0].toolName).toBe("google_search");
      expect(results[1].toolName).toBe("retrieve_context");
    });

    it("should handle mixed success and failure in batch", async () => {
      registerMockTool("google_search");

      const calls = [
        { toolName: "google_search" as ToolName, args: { query: "test" } },
        { toolName: "non_existent" as ToolName, args: {} },
      ];

      const results = await dispatcher.dispatchBatch(calls);

      expect(results).toHaveLength(2);
      expect(results[0].error).toBeUndefined();
      expect(results[1].error).toBeDefined();
    });

    it("should execute all calls even if some fail", async () => {
      registerMockTool("google_search", async () => {
        throw new Error("Failed");
      });
      registerMockTool("retrieve_context");

      const calls = [
        { toolName: "google_search" as ToolName, args: {} },
        { toolName: "retrieve_context" as ToolName, args: {} },
      ];

      const results = await dispatcher.dispatchBatch(calls);

      expect(results).toHaveLength(2);
      expect(results[0].error).toBe("Failed");
      expect(results[1].error).toBeUndefined();
    });
  });

  describe("cost calculation", () => {
    it("should apply base cost for quick executions", async () => {
      registerMockTool("google_search");

      const result = await dispatcher.dispatch("google_search", {});

      expect(result.cost).toBeCloseTo(TOOL_COST_CONFIG.BASE_COST_PER_CALL, 4);
    });

    it("should add time-based cost for long executions", async () => {
      registerMockTool("google_search", async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return {};
      });

      const result = await dispatcher.dispatch("google_search", {});

      expect(result.cost).toBeGreaterThan(TOOL_COST_CONFIG.BASE_COST_PER_CALL);
    });

    it("should apply cost modifiers for expensive tools", async () => {
      registerMockTool("workflow_orchestrator");
      registerMockTool("google_search");

      const result1 = await dispatcher.dispatch("workflow_orchestrator", {});
      const result2 = await dispatcher.dispatch("google_search", {});

      // workflow_orchestrator has 1.5x modifier
      expect(result1.cost).toBeGreaterThan(result2.cost);
    });

    it("should apply discount for cheaper tools", async () => {
      registerMockTool("retrieve_context");

      const result = await dispatcher.dispatch("retrieve_context", {});

      // retrieve_context has 0.8x modifier (cheaper)
      expect(result.cost).toBeLessThan(TOOL_COST_CONFIG.BASE_COST_PER_CALL);
    });
  });

  describe("metrics tracking", () => {
    it("should track total executions", async () => {
      registerMockTool("google_search");

      await dispatcher.dispatch("google_search", {});
      await dispatcher.dispatch("google_search", {});

      const metrics = dispatcher.getMetrics();
      expect(metrics.totalExecutions).toBe(2);
    });

    it("should track total cost", async () => {
      registerMockTool("google_search");

      await dispatcher.dispatch("google_search", {});
      await dispatcher.dispatch("google_search", {});

      const metrics = dispatcher.getMetrics();
      expect(metrics.totalCost).toBeGreaterThan(0);
    });

    it("should track execution time", async () => {
      registerMockTool("google_search", async (args) => {
        // Add small delay to ensure measurable execution time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { results: [] };
      });

      await dispatcher.dispatch("google_search", {});

      const metrics = dispatcher.getMetrics();
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });

    it("should track error count", async () => {
      registerMockTool("google_search", async () => {
        throw new Error("Failed");
      });

      await dispatcher.dispatch("google_search", {});
      await dispatcher.dispatch("google_search", {});

      const metrics = dispatcher.getMetrics();
      expect(metrics.errorCount).toBe(2);
      expect(metrics.errorRate).toBe(1.0);
    });

    it("should track executions by tool", async () => {
      registerMockTool("google_search");
      registerMockTool("retrieve_context");

      await dispatcher.dispatch("google_search", {});
      await dispatcher.dispatch("google_search", {});
      await dispatcher.dispatch("retrieve_context", {});

      const metrics = dispatcher.getMetrics();
      expect(metrics.executionsByTool["google_search"]).toBe(2);
      expect(metrics.executionsByTool["retrieve_context"]).toBe(1);
    });

    it("should calculate error rate correctly", async () => {
      registerMockTool("google_search", async () => {
        throw new Error("Failed");
      });
      registerMockTool("retrieve_context");

      await dispatcher.dispatch("google_search", {}); // error
      await dispatcher.dispatch("retrieve_context", {}); // success

      const metrics = dispatcher.getMetrics();
      expect(metrics.errorRate).toBeCloseTo(0.5, 1);
    });
  });

  describe("resetMetrics", () => {
    it("should reset all metrics to zero", async () => {
      registerMockTool("google_search");

      await dispatcher.dispatch("google_search", {});

      dispatcher.resetMetrics();
      const metrics = dispatcher.getMetrics();

      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.totalCost).toBe(0);
      expect(metrics.totalTime).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe("estimateCost", () => {
    it("should estimate cost for a tool", () => {
      const cost = dispatcher.estimateCost("google_search", 500);

      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeCloseTo(TOOL_COST_CONFIG.BASE_COST_PER_CALL, 4);
    });

    it("should estimate higher cost for expensive tools", () => {
      const cost1 = dispatcher.estimateCost("workflow_orchestrator", 500);
      const cost2 = dispatcher.estimateCost("google_search", 500);

      expect(cost1).toBeGreaterThan(cost2);
    });

    it("should estimate cost for long execution", () => {
      const cost1 = dispatcher.estimateCost("google_search", 500);
      const cost2 = dispatcher.estimateCost("google_search", 3000);

      expect(cost2).toBeGreaterThan(cost1);
    });
  });

  describe("error handling", () => {
    it("should handle tool execution throwing non-Error objects", async () => {
      registerMockTool("google_search", async () => {
        throw "String error";
      });

      const result = await dispatcher.dispatch("google_search", {});

      expect(result.error).toBe("Unknown error");
      expect(result.result).toBeNull();
    });

    it("should still calculate cost for failed executions", async () => {
      registerMockTool("google_search", async () => {
        throw new Error("Failed");
      });

      const result = await dispatcher.dispatch("google_search", {});

      expect(result.error).toBeDefined();
      expect(result.cost).toBeGreaterThan(0);
    });

    it("should track metrics for failed executions", async () => {
      registerMockTool("google_search", async () => {
        throw new Error("Failed");
      });

      await dispatcher.dispatch("google_search", {});

      const metrics = dispatcher.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.errorCount).toBe(1);
    });
  });
});
