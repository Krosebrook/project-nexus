import { api, APIError } from "encore.dev/api";
import db from "../db";

interface DeleteRequest {
  backup_id: number;
}

export const deleteBackup = api(
  { method: "DELETE", path: "/backups/:backup_id", expose: true },
  async (req: DeleteRequest): Promise<void> => {
    const backup = await db.queryRow`
      SELECT id FROM database_backups WHERE id = ${req.backup_id}
    `;

    if (!backup) {
      throw APIError.notFound("Backup not found");
    }

    await db.exec`
      DELETE FROM database_backups WHERE id = ${req.backup_id}
    `;
  }
);