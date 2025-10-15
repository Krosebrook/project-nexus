import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { RestoreBackupRequest, RestoreStatus } from "./types";

export const restore = api(
  { method: "POST", path: "/backups/:backup_id/restore", expose: true },
  async (req: RestoreBackupRequest): Promise<RestoreStatus> => {
    if (!req.confirm) {
      throw APIError.invalidArgument("Must confirm restore operation");
    }

    const backup = await db.queryRow<{ id: number; backup_data: any }>`
      SELECT id, backup_data FROM database_backups WHERE id = ${req.backup_id}
    `;

    if (!backup) {
      throw APIError.notFound("Backup not found");
    }

    const historyId = await db.queryRow<{ id: number }>`
      INSERT INTO backup_restore_history (
        backup_id, restored_by, restore_status
      ) VALUES (
        ${req.backup_id}, ${req.restored_by || null}, 'in_progress'
      )
      RETURNING id
    `;

    if (!historyId) {
      throw new Error("Failed to create restore history");
    }

    const rowsAffected: Record<string, number> = {};
    const errors: string[] = [];

    try {
      const tx = await db.begin();
      
      try {
        const backupData = backup.backup_data;
        
        for (const [tableName, rows] of Object.entries(backupData)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;

          await tx.rawExec(`DELETE FROM ${tableName}`);

          for (const row of rows) {
            const columns = Object.keys(row);
            const values = Object.values(row).map(v => {
              if (v === null || v === undefined) return null;
              if (typeof v === 'object') return JSON.stringify(v);
              return v;
            });
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            
            await tx.rawExec(
              `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
              ...(values as any[])
            );
          }

          rowsAffected[tableName] = rows.length;
        }

        await tx.commit();

        await db.exec`
          UPDATE backup_restore_history 
          SET restore_status = 'completed', rows_affected = ${JSON.stringify(rowsAffected)}::jsonb
          WHERE id = ${historyId.id}
        `;

        await db.exec`
          UPDATE database_backups 
          SET restored_at = NOW()
          WHERE id = ${req.backup_id}
        `;

      } catch (err) {
        await tx.rollback();
        throw err;
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(errorMsg);

      await db.exec`
        UPDATE backup_restore_history 
        SET restore_status = 'failed', restore_errors = ${errorMsg}
        WHERE id = ${historyId.id}
      `;

      throw APIError.internal("Restore failed: " + errorMsg);
    }

    const status = await db.queryRow<RestoreStatus>`
      SELECT * FROM backup_restore_history WHERE id = ${historyId.id}
    `;

    if (!status) {
      throw new Error("Failed to fetch restore status");
    }

    return status;
  }
);