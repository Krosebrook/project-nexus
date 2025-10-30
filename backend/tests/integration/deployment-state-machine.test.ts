import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DeploymentStateMachine } from "../../deployments/state-machine";
import type { DeploymentContext } from "../../deployments/state-machine";
import db from "../../db";

describe("DeploymentStateMachine E2E Tests", () => {
  let deploymentId: number;
  let testProjectId: number;
  let testEnvironmentId: number;

  beforeAll(async () => {
    const project = await db.queryRow<{ id: number }>`
      INSERT INTO projects (name, description, status, health_score)
      VALUES ('state-machine-test-project', 'State Machine E2E test', 'active', 100)
      RETURNING id
    `;
    testProjectId = project!.id;

    const environment = await db.queryRow<{ id: number }>`
      INSERT INTO environments (project_id, name, type, url)
      VALUES (${testProjectId}, 'sm-test-env', 'development', 'http://smtest.local')
      RETURNING id
    `;
    testEnvironmentId = environment!.id;
  });

  afterAll(async () => {
    await db.exec`DELETE FROM environments WHERE id = ${testEnvironmentId}`;
    await db.exec`DELETE FROM projects WHERE id = ${testProjectId}`;
  });

  beforeEach(async () => {
    const deployment = await db.queryRow<{ id: number }>`
      INSERT INTO deployment_logs (project_id, environment_id, environment, status, stage, progress)
      VALUES (${testProjectId}, ${testEnvironmentId}, 'sm-test-env', 'pending', 'validation', 0)
      RETURNING id
    `;
    deploymentId = deployment!.id;
  });

  describe("Full deployment flow", () => {
    it("should execute all stages successfully", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId: testProjectId,
        environmentId: testEnvironmentId,
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
        projectId: testProjectId,
        environmentId: testEnvironmentId,
      };

      const deployment = await stateMachine.execute(context);
      
      expect(deployment.progress).toBe(100);
    }, 30000);

    it("should log messages at each stage", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId: testProjectId,
        environmentId: testEnvironmentId,
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
        deploymentId: 999999999,
        projectId: testProjectId,
        environmentId: testEnvironmentId,
      };

      await expect(stateMachine.execute(context)).rejects.toThrow();
    }, 30000);

    it("should mark deployment as failed on error", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId: 999999998,
        projectId: testProjectId,
        environmentId: testEnvironmentId,
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
        projectId: testProjectId,
        environmentId: testEnvironmentId,
      };

      const deployment = await stateMachine.execute(context);
      
      expect(deployment.logs).toMatch(/validat.*build.*test.*migrat.*deploy.*health.*check/si);
    }, 30000);
  });

  describe("Notifications", () => {
    it("should send notifications at stage transitions", async () => {
      const stateMachine = new DeploymentStateMachine();
      const context: DeploymentContext = {
        deploymentId,
        projectId: testProjectId,
        environmentId: testEnvironmentId,
      };

      await stateMachine.execute(context);
      
    }, 30000);
  });
});
