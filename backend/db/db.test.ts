import { describe, it, expect, beforeEach } from "vitest";
import db from "./index";

describe("Database transaction rollback", () => {
  let testProjectId: number;

  beforeEach(async () => {
    const uniqueName = `Test Transaction Project ${Date.now()}-${Math.random()}`;
    const result = await db.query<{ id: number }>`
      INSERT INTO projects (name, description) 
      VALUES (${uniqueName}, 'Test project for transaction tests')
      RETURNING id
    `;
    for await (const row of result) {
      testProjectId = row.id;
    }
  });

  it("should rollback transaction on error", async () => {
    try {
      await using tx = await db.begin();

      await tx.exec`
        INSERT INTO alert_rules (project_id, name, condition, threshold, notification_channel)
        VALUES (${testProjectId}, 'Test Alert', 'cpu > threshold', 80, 'email')
      `;

      const alerts = await tx.queryAll<{ count: number }>`
        SELECT COUNT(*) as count FROM alert_rules WHERE project_id = ${testProjectId}
      `;
      expect(alerts[0].count).toBe(1);

      throw new Error("Simulated error to trigger rollback");
    } catch (err) {
      const alerts = await db.queryAll<{ count: number }>`
        SELECT COUNT(*) as count FROM alert_rules WHERE project_id = ${testProjectId}
      `;
      expect(alerts[0].count).toBe(0);
    }
  });

  it("should commit transaction when successful", async () => {
    await using tx = await db.begin();

    await tx.exec`
      INSERT INTO alert_rules (project_id, name, condition, threshold, notification_channel)
      VALUES (${testProjectId}, 'Committed Alert', 'memory > threshold', 90, 'slack')
    `;

    await tx.commit();

    const alerts = await db.queryAll<{ count: number }>`
      SELECT COUNT(*) as count FROM alert_rules WHERE project_id = ${testProjectId} AND name = 'Committed Alert'
    `;
    expect(alerts[0].count).toBe(1);
  });

  it("should rollback when explicitly called", async () => {
    await using tx = await db.begin();

    await tx.exec`
      INSERT INTO test_cases (project_id, name, input, expected_output)
      VALUES (${testProjectId}, 'Test Case', '{"key": "value"}', '{"result": "success"}')
    `;

    const tests = await tx.queryAll<{ count: number }>`
      SELECT COUNT(*) as count FROM test_cases WHERE project_id = ${testProjectId}
    `;
    expect(tests[0].count).toBe(1);

    await tx.rollback();

    const testsAfterRollback = await db.queryAll<{ count: number }>`
      SELECT COUNT(*) as count FROM test_cases WHERE project_id = ${testProjectId}
    `;
    expect(testsAfterRollback[0].count).toBe(0);
  });

  it("should handle nested transaction context", async () => {
    await using tx = await db.begin();

    await tx.exec`
      INSERT INTO context_snapshots (project_id, work_state, next_steps, open_files)
      VALUES (${testProjectId}, '{"task": "test"}', ARRAY['step1', 'step2'], ARRAY['file1.ts'])
    `;

    const snapshot = await tx.queryRow<{ id: number }>`
      SELECT id FROM context_snapshots WHERE project_id = ${testProjectId}
    `;
    expect(snapshot).toBeTruthy();
    expect(snapshot?.id).toBeGreaterThan(0);

    await tx.commit();

    const snapshotAfterCommit = await db.queryRow<{ id: number }>`
      SELECT id FROM context_snapshots WHERE project_id = ${testProjectId}
    `;
    expect(snapshotAfterCommit).toBeTruthy();
  });

  it("should rollback multiple operations atomically", async () => {
    try {
      await using tx = await db.begin();

      await tx.exec`
        INSERT INTO alert_rules (project_id, name, condition, threshold, notification_channel)
        VALUES (${testProjectId}, 'Alert 1', 'condition1', 50, 'email')
      `;

      await tx.exec`
        INSERT INTO test_cases (project_id, name, input, expected_output)
        VALUES (${testProjectId}, 'Test 1', '{}', '{}')
      `;

      await tx.exec`
        INSERT INTO file_moves (project_id, original_path, new_path)
        VALUES (${testProjectId}, '/old/path', '/new/path')
      `;

      throw new Error("Rollback all operations");
    } catch (err) {
      const alerts = await db.queryAll<{ count: number }>`
        SELECT COUNT(*) as count FROM alert_rules WHERE project_id = ${testProjectId}
      `;
      const tests = await db.queryAll<{ count: number }>`
        SELECT COUNT(*) as count FROM test_cases WHERE project_id = ${testProjectId}
      `;
      const moves = await db.queryAll<{ count: number }>`
        SELECT COUNT(*) as count FROM file_moves WHERE project_id = ${testProjectId}
      `;

      expect(alerts[0].count).toBe(0);
      expect(tests[0].count).toBe(0);
      expect(moves[0].count).toBe(0);
    }
  });
});
