import { api } from "encore.dev/api";
import db from "../db";
import type { ContextSnapshot } from "./types";

interface ListContextsParams {
  project_id: number;
}

interface ListContextsResponse {
  snapshots: ContextSnapshot[];
}

// Retrieves all context snapshots for a project.
export const list = api<ListContextsParams, ListContextsResponse>(
  { expose: true, method: "GET", path: "/contexts/:project_id" },
  async ({ project_id }) => {
    const snapshots = await db.queryAll<ContextSnapshot>`
      SELECT id, project_id, work_state, next_steps, open_files, notes, is_current, created_at, updated_at
      FROM context_snapshots
      WHERE project_id = ${project_id}
      ORDER BY created_at DESC
    `;
    return { snapshots };
  }
);
