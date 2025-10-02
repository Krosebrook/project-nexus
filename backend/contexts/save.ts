import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { ContextSnapshot } from "./types";

interface SaveContextRequest {
  project_id: number;
  work_state: Record<string, any>;
  next_steps: string[];
  open_files: string[];
  notes?: string;
}

// Saves a new context snapshot and marks it as current.
export const save = api<SaveContextRequest, ContextSnapshot>(
  { expose: true, method: "POST", path: "/contexts" },
  async ({ project_id, work_state, next_steps, open_files, notes }) => {
    if (!work_state || typeof work_state !== "object") {
      throw APIError.invalidArgument("work_state must be an object");
    }
    if (!Array.isArray(next_steps)) {
      throw APIError.invalidArgument("next_steps must be an array");
    }
    if (!Array.isArray(open_files)) {
      throw APIError.invalidArgument("open_files must be an array");
    }
    await using tx = await db.begin();

    await tx.exec`
      UPDATE context_snapshots
      SET is_current = false
      WHERE project_id = ${project_id} AND is_current = true
    `;

    const snapshot = await tx.queryRow<ContextSnapshot>`
      INSERT INTO context_snapshots (project_id, work_state, next_steps, open_files, notes, is_current)
      VALUES (${project_id}, ${JSON.stringify(work_state)}, ${next_steps}, ${open_files}, ${notes ?? null}, true)
      RETURNING id, project_id, work_state, next_steps, open_files, notes, is_current, created_at, updated_at
    `;

    await tx.commit();
    return snapshot!;
  }
);
