import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { ContextSnapshot } from "./types";

export interface RestoreContextRequest {
  id: number;
}

export const restore = api<RestoreContextRequest, ContextSnapshot>(
  { method: "POST", path: "/contexts/:id/restore", expose: true },
  async (req) => {
    const snapshot = await db.queryRow<ContextSnapshot>`
      SELECT * FROM context_snapshots WHERE id = ${req.id}
    `;

    if (!snapshot) {
      throw APIError.notFound("context snapshot not found");
    }

    const projectId = snapshot.project_id;

    await db.query`
      UPDATE context_snapshots 
      SET is_current = false 
      WHERE project_id = ${projectId}
    `;

    const result = await db.queryRow<ContextSnapshot>`
      UPDATE context_snapshots 
      SET is_current = true, updated_at = NOW() 
      WHERE id = ${req.id}
      RETURNING *
    `;

    return result!;
  }
);
