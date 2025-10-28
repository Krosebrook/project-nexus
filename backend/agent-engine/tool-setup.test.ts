/**
 * Tool Setup Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  setupTools,
  getConfiguredTools,
  listAvailableTools,
} from "./tool-setup";

describe("Tool Setup", () => {
  describe("setupTools", () => {
    it("should setup all 5 tools", () => {
      const { registry, dispatcher } = setupTools();

      expect(registry.count()).toBe(5);
      expect(dispatcher).toBeDefined();
    });

    it("should register workflow_orchestrator", () => {
      const { registry } = setupTools();

      const tool = registry.get("workflow_orchestrator");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("workflow_orchestrator");
      expect(tool?.description).toContain("workflow");
    });

    it("should register google_search", () => {
      const { registry } = setupTools();

      const tool = registry.get("google_search");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("google_search");
      expect(tool?.description).toContain("search");
    });

    it("should register code_executor", () => {
      const { registry } = setupTools();

      const tool = registry.get("code_executor");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("code_executor");
      expect(tool?.description).toContain("code");
    });

    it("should register submit_parallel_job", () => {
      const { registry } = setupTools();

      const tool = registry.get("submit_parallel_job");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("submit_parallel_job");
      expect(tool?.description).toContain("job");
    });

    it("should register retrieve_context", () => {
      const { registry } = setupTools();

      const tool = registry.get("retrieve_context");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("retrieve_context");
      expect(tool?.description).toContain("context");
    });

    it("should create working dispatcher", async () => {
      const { dispatcher } = setupTools();

      const result = await dispatcher.dispatch("google_search", {
        query: "test",
        limit: 3,
      });

      expect(result.toolName).toBe("google_search");
      expect(result.error).toBeUndefined();
    });
  });

  describe("getConfiguredTools", () => {
    beforeEach(() => {
      setupTools(); // Ensure tools are setup
    });

    it("should return configured tools", () => {
      const { registry, dispatcher } = getConfiguredTools();

      expect(registry).toBeDefined();
      expect(dispatcher).toBeDefined();
      expect(registry.count()).toBe(5);
    });

    it("should return same registry instance", () => {
      const { registry: registry1 } = getConfiguredTools();
      const { registry: registry2 } = getConfiguredTools();

      expect(registry1.count()).toBe(registry2.count());
    });

    it("should setup tools if not already setup", () => {
      const { registry } = getConfiguredTools();

      expect(registry.count()).toBeGreaterThan(0);
    });
  });

  describe("listAvailableTools", () => {
    beforeEach(() => {
      setupTools();
    });

    it("should list all 5 tools", () => {
      const tools = listAvailableTools();

      expect(tools).toHaveLength(5);
    });

    it("should include tool names", () => {
      const tools = listAvailableTools();
      const names = tools.map((t) => t.name);

      expect(names).toContain("workflow_orchestrator");
      expect(names).toContain("google_search");
      expect(names).toContain("code_executor");
      expect(names).toContain("submit_parallel_job");
      expect(names).toContain("retrieve_context");
    });

    it("should include tool descriptions", () => {
      const tools = listAvailableTools();

      tools.forEach((tool) => {
        expect(tool.description).toBeTruthy();
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });

    it("should return tools with expected structure", () => {
      const tools = listAvailableTools();

      tools.forEach((tool) => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
      });
    });
  });

  describe("tool integration", () => {
    it("should execute workflow_orchestrator through dispatcher", async () => {
      const { dispatcher } = setupTools();

      const result = await dispatcher.dispatch("workflow_orchestrator", {
        workflowName: "data-pipeline",
        params: { recordCount: 1000 },
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(result.result.status).toBe("completed");
    });

    it("should execute google_search through dispatcher", async () => {
      const { dispatcher } = setupTools();

      const result = await dispatcher.dispatch("google_search", {
        query: "artificial intelligence",
        limit: 3,
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(Array.isArray(result.result)).toBe(true);
    });

    it("should execute code_executor through dispatcher", async () => {
      const { dispatcher } = setupTools();

      const result = await dispatcher.dispatch("code_executor", {
        code: 'console.log("Hello")',
        language: "javascript",
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(result.result.stdout).toBe("Hello");
    });

    it("should execute submit_parallel_job through dispatcher", async () => {
      const { dispatcher } = setupTools();

      const result = await dispatcher.dispatch("submit_parallel_job", {
        jobSpec: {
          type: "data-processing",
          params: { recordCount: 5000 },
        },
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(result.result.jobId).toMatch(/^job_/);
    });

    it("should execute retrieve_context through dispatcher", async () => {
      const { dispatcher } = setupTools();

      const result = await dispatcher.dispatch("retrieve_context", {
        query: "programming best practices",
        limit: 3,
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(Array.isArray(result.result)).toBe(true);
    });

    it("should validate code before execution", async () => {
      const { dispatcher } = setupTools();

      const result = await dispatcher.dispatch("code_executor", {
        code: 'require("fs")',
        language: "javascript",
      });

      expect(result.error).toContain("unsafe code");
    });

    it("should track costs for all tool executions", async () => {
      const { dispatcher } = setupTools();

      await dispatcher.dispatch("google_search", { query: "test" });
      await dispatcher.dispatch("retrieve_context", { query: "test" });

      const metrics = dispatcher.getMetrics();
      expect(metrics.totalCost).toBeGreaterThan(0);
      expect(metrics.totalExecutions).toBe(2);
    });

    it("should handle errors gracefully", async () => {
      const { dispatcher } = setupTools();

      const result = await dispatcher.dispatch("workflow_orchestrator", {
        workflowName: "unknown-workflow",
        params: {},
      });

      expect(result.error).toBeUndefined(); // Tool executes but returns error in result
      expect(result.result.status).toBe("failed");
    });
  });
});
