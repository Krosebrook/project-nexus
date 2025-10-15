import { describe, it, expect, beforeAll } from "vitest";
import db from "../../db";

describe("Approval Workflow Integration Tests", () => {
  let testProjectId: number;
  let testDeploymentId: number;
  let testUserId: number;

  beforeAll(async () => {
    const project = await db.queryRow<{ id: number }>`
      INSERT INTO projects (name)
      VALUES (${`Test Approval Project ${Date.now()}`})
      RETURNING id
    `;
    testProjectId = project!.id;

    const deployment = await db.queryRow<{ id: number }>`
      INSERT INTO deployment_logs (project_id, environment, status)
      VALUES (${testProjectId}, 'production', 'pending')
      RETURNING id
    `;
    testDeploymentId = deployment!.id;

    const user = await db.queryRow<{ id: number }>`
      INSERT INTO users (user_id, email, name)
      VALUES ('test_approver', 'approver@test.com', 'Test Approver')
      ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `;
    testUserId = user!.id;
  });

  it("should create approval request", async () => {
    const approval = await db.queryRow<{ id: number; status: string }>`
      INSERT INTO deployment_approvals (deployment_id, required_approvals)
      VALUES (${testDeploymentId}, 2)
      RETURNING id, status
    `;

    expect(approval).toBeDefined();
    expect(approval?.status).toBe('pending');
  });

  it("should create approval rule", async () => {
    const rule = await db.queryRow<{ id: number; environment: string }>`
      INSERT INTO approval_rules (project_id, name, environment, required_approvals)
      VALUES (${testProjectId}, 'Production Approvals', 'production', 2)
      RETURNING id, environment
    `;

    expect(rule).toBeDefined();
    expect(rule?.environment).toBe('production');
  });

  it("should record approval action", async () => {
    const approval = await db.queryRow<{ id: number }>`
      INSERT INTO deployment_approvals (deployment_id, required_approvals)
      VALUES (${testDeploymentId}, 1)
      RETURNING id
    `;

    const action = await db.queryRow<{ id: number; action: string }>`
      INSERT INTO approval_actions (approval_id, user_id, action, comment)
      VALUES (${approval!.id}, ${testUserId}, 'approve', 'Looks good')
      RETURNING id, action
    `;

    expect(action).toBeDefined();
    expect(action?.action).toBe('approve');
  });
});