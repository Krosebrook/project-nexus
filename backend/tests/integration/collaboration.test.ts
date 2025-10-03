import { describe, it, expect, beforeAll } from "vitest";
import db from "../../db";

describe("Collaboration Integration Tests", () => {
  let testUserId: number;
  let testProjectId: number;

  beforeAll(async () => {
    const project = await db.queryRow<{ id: number }>`
      INSERT INTO projects (name, description)
      VALUES (${`Test Collaboration Project ${Date.now()}`}, 'For testing')
      RETURNING id
    `;
    testProjectId = project!.id;

    const user = await db.queryRow<{ id: number }>`
      INSERT INTO users (user_id, email, name, role)
      VALUES ('test_collab_user', 'collab@test.com', 'Test User', 'developer')
      ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `;
    testUserId = user!.id;
  });

  it("should add a project member", async () => {
    const member = await db.queryRow<{ id: number; user_id: number }>`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (${testProjectId}, ${testUserId}, 'member')
      ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING id, user_id
    `;

    expect(member).toBeDefined();
    expect(member?.user_id).toBe(testUserId);
  });

  it("should log activity", async () => {
    const activity = await db.queryRow<{ id: number; action_type: string }>`
      INSERT INTO activity_log (project_id, user_id, action_type, description)
      VALUES (${testProjectId}, ${testUserId}, 'test_action', 'Test activity')
      RETURNING id, action_type
    `;

    expect(activity).toBeDefined();
    expect(activity?.action_type).toBe('test_action');
  });

  it("should create comments", async () => {
    const comment = await db.queryRow<{ id: number; content: string }>`
      INSERT INTO comments (project_id, user_id, entity_type, entity_id, content)
      VALUES (${testProjectId}, ${testUserId}, 'deployment', 1, 'Test comment')
      RETURNING id, content
    `;

    expect(comment).toBeDefined();
    expect(comment?.content).toBe('Test comment');
  });

  it("should update user presence", async () => {
    const presence = await db.queryRow<{ id: number; status: string }>`
      INSERT INTO user_presence (user_id, project_id, status)
      VALUES (${testUserId}, ${testProjectId}, 'online')
      ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status
      RETURNING id, status
    `;

    expect(presence).toBeDefined();
    expect(presence?.status).toBe('online');
  });
});