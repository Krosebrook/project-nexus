import { api } from "encore.dev/api";
import db from "../db";
import type { SaveSnapshotRequest, ContextSnapshot } from "./types";

export const save = api(
  { method: "POST", path: "/snapshots", expose: true },
  async (req: SaveSnapshotRequest): Promise<ContextSnapshot> => {
    const result = await db.queryRow<ContextSnapshot>`
      INSERT INTO context_snapshots (project_id, notes, urls)
      VALUES (${req.project_id}, ${req.notes}, ${req.urls})
      RETURNING *
    `;
    if (!result) throw new Error('Failed to create snapshot');
    return result;
  }
);