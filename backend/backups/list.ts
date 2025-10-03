import { api } from "encore.dev/api";
import db from "../db";
import type { BackupListResponse, DatabaseBackup } from "./types";

interface ListRequest {
  limit?: number;
  offset?: number;
  backup_type?: string;
}

export const list = api(
  { method: "GET", path: "/backups", expose: true },
  async (req: ListRequest): Promise<BackupListResponse> => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `
      SELECT 
        id, backup_name, description, backup_type,
        file_size, created_by, created_at, restored_at
      FROM database_backups
    `;
    const params: any[] = [];

    if (req.backup_type) {
      query += ` WHERE backup_type = $1`;
      params.push(req.backup_type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const backups = await db.rawQueryAll(query, ...params);

    const countResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM database_backups
    `;

    return {
      backups: backups.map(b => ({
        ...b,
        backup_data: {}
      })) as DatabaseBackup[],
      total: Number(countResult?.count || 0)
    };
  }
);