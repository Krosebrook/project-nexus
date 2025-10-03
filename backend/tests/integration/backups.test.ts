import { describe, it, expect, beforeAll } from "vitest";
import db from "../../db";

describe("Backup Integration Tests", () => {
  beforeAll(async () => {
    await db.exec`DELETE FROM database_backups WHERE backup_name LIKE 'test_%'`;
  });

  it("should create a backup successfully", async () => {
    const backupName = `test_backup_${Date.now()}`;
    
    const result = await db.queryRow<{ id: number; backup_name: string }>`
      INSERT INTO database_backups (backup_name, backup_type, backup_data)
      VALUES (${backupName}, 'manual', '{}'::jsonb)
      RETURNING id, backup_name
    `;

    expect(result).toBeDefined();
    expect(result?.backup_name).toBe(backupName);
  });

  it("should list backups", async () => {
    const backups = await db.queryAll`
      SELECT * FROM database_backups
      ORDER BY created_at DESC
      LIMIT 10
    `;

    expect(Array.isArray(backups)).toBe(true);
  });

  it("should prevent duplicate backup names", async () => {
    const backupName = `test_unique_${Date.now()}`;
    
    await db.exec`
      INSERT INTO database_backups (backup_name, backup_type, backup_data)
      VALUES (${backupName}, 'manual', '{}'::jsonb)
    `;

    await expect(
      db.exec`
        INSERT INTO database_backups (backup_name, backup_type, backup_data)
        VALUES (${backupName}, 'manual', '{}'::jsonb)
      `
    ).rejects.toThrow();
  });
});