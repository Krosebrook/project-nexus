/**
 * Workflow Orchestrator Tests
 */
import { describe, it, expect } from "vitest";
import { WorkflowOrchestrator } from "./workflow-orchestrator";

describe("WorkflowOrchestrator", () => {
  const orchestrator = new WorkflowOrchestrator();

  describe("executeWorkflow", () => {
    it("should execute data-pipeline workflow", async () => {
      const result = await orchestrator.executeWorkflow("data-pipeline", {
        source: "mysql",
        recordCount: 5000,
        destination: "postgres",
      });

      expect(result.status).toBe("completed");
      expect(result.workflowId).toMatch(/^wf_/);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.output.pipelineName).toBe("data-pipeline");
      expect(result.output.recordsProcessed).toBe(5000);
      expect(result.output.source).toBe("mysql");
      expect(result.output.outputDestination).toBe("postgres");
    });

    it("should execute api-call-chain workflow", async () => {
      const result = await orchestrator.executeWorkflow("api-call-chain", {
        apis: ["userService", "orderService", "inventoryService"],
      });

      expect(result.status).toBe("completed");
      expect(result.output.chainName).toBe("api-call-chain");
      expect(result.output.results).toHaveLength(3);
      expect(result.output.aggregatedOutput.totalCalls).toBe(3);
      expect(result.output.aggregatedOutput.successfulCalls).toBe(3);
    });

    it("should execute notification-workflow", async () => {
      const result = await orchestrator.executeWorkflow("notification-workflow", {
        recipients: ["user1@example.com", "user2@example.com"],
        channel: "email",
        message: "Test notification",
      });

      expect(result.status).toBe("completed");
      expect(result.output.workflowName).toBe("notification-workflow");
      expect(result.output.channel).toBe("email");
      expect(result.output.recipientsCount).toBe(2);
      expect(result.output.deliveryStatus).toHaveLength(2);
      expect(result.output.summary.delivered).toBe(2);
    });

    it("should execute etl-process workflow", async () => {
      const result = await orchestrator.executeWorkflow("etl-process", {
        source: "mongodb",
        destination: "snowflake",
      });

      expect(result.status).toBe("completed");
      expect(result.output.processName).toBe("etl-process");
      expect(result.output.stages.extract).toBeDefined();
      expect(result.output.stages.transform).toBeDefined();
      expect(result.output.stages.load).toBeDefined();
      expect(result.output.summary.totalRecords).toBeGreaterThan(0);
    });

    it("should execute report-generation workflow", async () => {
      const result = await orchestrator.executeWorkflow("report-generation", {
        reportType: "analytics",
        format: "pdf",
      });

      expect(result.status).toBe("completed");
      expect(result.output.reportName).toBe("report-generation");
      expect(result.output.reportType).toBe("analytics");
      expect(result.output.format).toBe("pdf");
      expect(result.output.output.pages).toBeGreaterThan(0);
      expect(result.output.output.downloadUrl).toMatch(/^\/reports\//);
    });

    it("should handle unknown workflow", async () => {
      const result = await orchestrator.executeWorkflow("unknown-workflow", {});

      expect(result.status).toBe("failed");
      expect(result.output.error).toContain("Unknown workflow");
      expect(result.output.availableWorkflows).toContain("data-pipeline");
    });

    it("should use default parameters when not provided", async () => {
      const result = await orchestrator.executeWorkflow("data-pipeline");

      expect(result.status).toBe("completed");
      expect(result.output.recordsProcessed).toBe(1000); // default
      expect(result.output.source).toBe("database"); // default
    });

    it("should track execution time", async () => {
      const result = await orchestrator.executeWorkflow("data-pipeline");

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(5000); // Should complete quickly
    });

    it("should generate unique workflow IDs", async () => {
      const result1 = await orchestrator.executeWorkflow("data-pipeline");
      const result2 = await orchestrator.executeWorkflow("data-pipeline");

      expect(result1.workflowId).not.toBe(result2.workflowId);
    });
  });
});
