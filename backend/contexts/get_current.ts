import { api } from "encore.dev/api";
import db from "../db";
import type { ContextSnapshot } from "./types";

interface GetCurrentContextParams {
  project_id: number;
}

interface GetCurrentContextResponse {
  snapshot: ContextSnapshot | null;
}

// Retrieves the current context snapshot for a project.
export const getCurrent = api<GetCurrentContextParams, GetCurrentContextResponse>(
  { expose: true, method: "GET", path: "/contexts/:project_id/current" },
  async ({ project_id }) => {
    const snapshot = await db.queryRow<ContextSnapshot>`
      SELECT id, project_id, work_state, next_steps, open_files, notes, is_current, created_at, updated_at
      FROM context_snapshots
      WHERE project_id = ${project_id} AND is_current = true
      LIMIT 1
    `;
    return { snapshot };
  }
);
