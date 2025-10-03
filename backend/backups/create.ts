import { api } from "encore.dev/api";
import db from "../db";
import type { CreateBackupRequest, DatabaseBackup } from "./types";
import { BackupSchema, validateSchema } from "../shared/validation";

export const create = api(
  { method: "POST", path: "/backups", expose: true },
  async (req: CreateBackupRequest): Promise<DatabaseBackup> => {
    validateSchema(BackupSchema, req);
    const backupData: Record<string, any[]> = {};
    const tablesToBackup = req.include_tables || [
      "projects",
      "context_snapshots",
      "test_cases",
      "alert_rules",
      "file_moves",
      "user_preferences"
    ];

    for (const table of tablesToBackup) {
      const rows = await db.rawQueryAll(`SELECT * FROM ${table}`);
      backupData[table] = rows;
    }

    const dataString = JSON.stringify(backupData);
    const fileSize = Buffer.byteLength(dataString, 'utf8');

    const result = await db.queryRow<DatabaseBackup>`
      INSERT INTO database_backups (
        backup_name,
        description,
        backup_type,
        file_size,
        backup_data,
        created_by
      ) VALUES (
        ${req.backup_name},
        ${req.description || null},
        ${req.backup_type || "manual"},
        ${fileSize},
        ${dataString}::jsonb,
        ${req.created_by || null}
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create backup");
    }

    return result;
  }
);