import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DeploymentStateMachine, type DeploymentContext } from "../../deployments/state-machine";
import db from "../../db";
import type { DeploymentLog } from "../../deployments/types";

describe("Deployment Flow E2E Tests", () => {
  let testProjectId: number;
  let testEnvironmentId: number;

  beforeAll(async () => {
    const project = await db.queryRow<{ id: number }>`
      INSERT INTO projects (name, description, status, health_score)
      VALUES ('e2e-test-project', 'E2E test project', 'active', 100)
      RETURNING id
    `;
    testProjectId = project!.id;

    const environment = await db.queryRow<{ id: number }>`
      INSERT INTO environments (project_id, name, type, url)
      VALUES (${testProjectId}, 'test-env', 'development', 'http://test.local')
      RETURNING id
    `;
    testEnvironmentId = environment!.id;
  });

  afterAll(async () => {
    await db.exec`DELETE FROM environments WHERE id = ${testEnvironmentId}`;
    await db.exec`DELETE FROM projects WHERE id = ${testProjectId}`;
  });

  it("should successfully execute full deployment flow", { timeout: 10000 }, async () => {
    const deployment = await db.queryRow<DeploymentLog>`
      INSERT INTO deployment_logs (project_id, environment_id, environment, status, stage, progress)
      VALUES (${testProjectId}, ${testEnvironmentId}, 'test-env', 'pending', 'validation', 0)
      RETURNING *
    `;

    expect(deployment).toBeDefined();
    expect(deployment!.status).toBe("pending");

    const context: DeploymentContext = {
      deploymentId: deployment!.id,
      projectId: testProjectId,
      environmentId: testEnvironmentId,
    };

    const stateMachine = new DeploymentStateMachine();
    const result = await stateMachine.execute(context);

    expect(result).toBeDefined();
    expect(result.status).toBe("success");
    expect(result.stage).toBe("complete");
    expect(result.progress).toBe(100);
    expect(result.completed_at).toBeDefined();

    await db.exec`DELETE FROM deployment_logs WHERE id = ${deployment!.id}`;
  });

  it("should track progress through all stages", { timeout: 10000 }, async () => {
    const deployment = await db.queryRow<DeploymentLog>`
      INSERT INTO deployment_logs (project_id, environment_id, environment, status, stage, progress)
      VALUES (${testProjectId}, ${testEnvironmentId}, 'test-env', 'pending', 'validation', 0)
      RETURNING *
    `;

    const context: DeploymentContext = {
      deploymentId: deployment!.id,
      projectId: testProjectId,
      environmentId: testEnvironmentId,
    };

    const stateMachine = new DeploymentStateMachine();
    await stateMachine.execute(context);

    const finalDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${deployment!.id}
    `;

    expect(finalDeployment).toBeDefined();
    expect(finalDeployment!.logs).toContain("Validating deployment configuration");
    expect(finalDeployment!.logs).toContain("Building project");
    expect(finalDeployment!.logs).toContain("Running test suite");
    expect(finalDeployment!.logs).toContain("Running database migrations");
    expect(finalDeployment!.logs).toContain("Deploying artifacts");
    expect(finalDeployment!.logs).toContain("Performing health check");

    await db.exec`DELETE FROM deployment_logs WHERE id = ${deployment!.id}`;
  });

  it("should handle deployment with existing logs", { timeout: 10000 }, async () => {
    const deployment = await db.queryRow<DeploymentLog>`
      INSERT INTO deployment_logs (project_id, environment_id, environment, status, stage, progress, logs)
      VALUES (${testProjectId}, ${testEnvironmentId}, 'test-env', 'pending', 'validation', 0, 'Initial log entry')
      RETURNING *
    `;

    const context: DeploymentContext = {
      deploymentId: deployment!.id,
      projectId: testProjectId,
      environmentId: testEnvironmentId,
    };

    const stateMachine = new DeploymentStateMachine();
    await stateMachine.execute(context);

    const finalDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${deployment!.id}
    `;

    expect(finalDeployment).toBeDefined();
    expect(finalDeployment!.logs).toContain("Initial log entry");
    expect(finalDeployment!.logs).toContain("Validating deployment configuration");

    await db.exec`DELETE FROM deployment_logs WHERE id = ${deployment!.id}`;
  });

  it("should set completed_at timestamp on success", { timeout: 10000 }, async () => {
    const deployment = await db.queryRow<DeploymentLog>`
      INSERT INTO deployment_logs (project_id, environment_id, environment, status, stage, progress)
      VALUES (${testProjectId}, ${testEnvironmentId}, 'test-env', 'pending', 'validation', 0)
      RETURNING *
    `;

    const context: DeploymentContext = {
      deploymentId: deployment!.id,
      projectId: testProjectId,
      environmentId: testEnvironmentId,
    };

    const beforeTime = new Date();
    const stateMachine = new DeploymentStateMachine();
    await stateMachine.execute(context);
    const afterTime = new Date();

    const finalDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${deployment!.id}
    `;

    expect(finalDeployment).toBeDefined();
    expect(finalDeployment!.completed_at).toBeDefined();
    
    const completedAt = new Date(finalDeployment!.completed_at!);
    expect(completedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(completedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());

    await db.exec`DELETE FROM deployment_logs WHERE id = ${deployment!.id}`;
  });

  it("should update updated_at timestamp during execution", { timeout: 10000 }, async () => {
    const deployment = await db.queryRow<DeploymentLog>`
      INSERT INTO deployment_logs (project_id, environment_id, environment, status, stage, progress)
      VALUES (${testProjectId}, ${testEnvironmentId}, 'test-env', 'pending', 'validation', 0)
      RETURNING *
    `;

    const initialUpdatedAt = new Date(deployment!.updated_at);

    const context: DeploymentContext = {
      deploymentId: deployment!.id,
      projectId: testProjectId,
      environmentId: testEnvironmentId,
    };

    const stateMachine = new DeploymentStateMachine();
    await stateMachine.execute(context);

    const finalDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${deployment!.id}
    `;

    expect(finalDeployment).toBeDefined();
    const finalUpdatedAt = new Date(finalDeployment!.updated_at);
    expect(finalUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());

    await db.exec`DELETE FROM deployment_logs WHERE id = ${deployment!.id}`;
  });
});