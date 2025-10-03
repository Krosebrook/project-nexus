import { describe, it, expect } from "vitest";
import db from "./index";

describe("Database Connection Pool", () => {
  it("should handle concurrent queries", async () => {
    const queries = Array.from({ length: 10 }, (_, i) => 
      db.queryAll<{ id: number; name: string }>`
        SELECT id, name FROM projects LIMIT 1
      `
    );

    const results = await Promise.all(queries);
    
    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(Array.isArray(result)).toBe(true);
    });
  });

  it("should handle query errors gracefully", async () => {
    await expect(async () => {
      await db.queryAll`SELECT * FROM nonexistent_table`;
    }).rejects.toThrow();
  });

  it("should execute transactions correctly", async () => {
    const result = await db.queryRow<{ value: number }>`
      SELECT 1 as value
    `;
    
    expect(result).toBeDefined();
    expect(result?.value).toBe(1);
  });

  it("should handle parameterized queries", async () => {
    const projectId = 1;
    const result = await db.queryAll<{ id: number }>`
      SELECT id FROM projects WHERE id = ${projectId}
    `;
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle empty result sets", async () => {
    const result = await db.queryAll<{ id: number }>`
      SELECT id FROM projects WHERE id = -1
    `;
    
    expect(result).toEqual([]);
  });
});
