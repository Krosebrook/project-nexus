import { describe, it, expect } from "vitest";
import db from "../../db";

describe("Error Logging Integration Tests", () => {
  it("should log an error", async () => {
    const error = await db.queryRow<{ id: number; error_type: string }>`
      INSERT INTO error_logs (
        error_type, error_message, error_stack, severity
      )
      VALUES (
        'TestError',
        'This is a test error',
        'Error stack trace here',
        'error'
      )
      RETURNING id, error_type
    `;

    expect(error).toBeDefined();
    expect(error?.error_type).toBe('TestError');
  });

  it("should retrieve error stats", async () => {
    const total = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM error_logs
    `;

    expect(total).toBeDefined();
    expect(Number(total?.count)).toBeGreaterThanOrEqual(0);
  });

  it("should group errors by type", async () => {
    const grouped = await db.queryAll<{ error_type: string; count: number }>`
      SELECT error_type, COUNT(*) as count
      FROM error_logs
      GROUP BY error_type
      LIMIT 5
    `;

    expect(Array.isArray(grouped)).toBe(true);
  });

  it("should resolve errors", async () => {
    const error = await db.queryRow<{ id: number }>`
      INSERT INTO error_logs (error_type, error_message, severity)
      VALUES ('ResolvableError', 'Test', 'warning')
      RETURNING id
    `;

    const resolved = await db.queryRow<{ is_resolved: boolean }>`
      UPDATE error_logs
      SET is_resolved = true
      WHERE id = ${error!.id}
      RETURNING is_resolved
    `;

    expect(resolved?.is_resolved).toBe(true);
  });
});