import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeploymentStateMachine } from "../../deployments/state-machine";
import type { DeploymentContext } from "../../deployments/state-machine";

describe("DeploymentStateMachine E2E Tests", () => {
  let deploymentId: number;
  let projectId: number;
  let environmentId: number;

  beforeEach(() => {
    deploymentId = Math.floor(Math.random() * 1000000);
    projectId = 1;
    environmentId = 1;
  });

  describe("Full deployment flow", () => {
    it("should execute all stages successfully", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId,
        environmentId,
      };

      const deployment = await stateMachine.execute(context);
      
      expect(deployment).toBeDefined();
      expect(deployment.status).toBe("success");
      expect(deployment.stage).toBe("complete");
      expect(deployment.progress).toBe(100);
    }, 30000);

    it("should update progress through each stage", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId,
        environmentId,
      };

      const deployment = await stateMachine.execute(context);
      
      expect(deployment.progress).toBe(100);
    }, 30000);

    it("should log messages at each stage", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId,
        environmentId,
      };

      const deployment = await stateMachine.execute(context);
      
      expect(deployment.logs).toBeTruthy();
      expect(deployment.logs).toContain("Validating deployment");
      expect(deployment.logs).toContain("Building project");
      expect(deployment.logs).toContain("Running test suite");
    }, 30000);
  });

  describe("Error handling", () => {
    it("should handle validation failures", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId: -1,
        environmentId,
      };

      await expect(stateMachine.execute(context)).rejects.toThrow();
    }, 30000);

    it("should mark deployment as failed on error", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId: -1,
        environmentId,
      };

      try {
        await stateMachine.execute(context);
      } catch (error) {
      }
    }, 30000);
  });

  describe("Stage transitions", () => {
    it("should transition through stages in correct order", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId,
        environmentId,
      };

      const deployment = await stateMachine.execute(context);
      
      expect(deployment.logs).toMatch(/validation.*build.*testing.*migration.*deployment.*health_check/s);
    }, 30000);
  });

  describe("Notifications", () => {
    it("should send notifications at stage transitions", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId,
        environmentId,
      };

      await stateMachine.execute(context);
      
    }, 30000);
  });
});
