import { api } from "encore.dev/api";
import db from "../db";
import type { FileMove } from "./types";

interface ListFilesParams {
  project_id: number;
}

interface ListFilesResponse {
  moves: FileMove[];
}

// Retrieves file move history for a project.
export const list = api<ListFilesParams, ListFilesResponse>(
  { expose: true, method: "GET", path: "/files/:project_id" },
  async ({ project_id }) => {
    const moves = await db.queryAll<FileMove>`
      SELECT id, project_id, original_path, new_path, reason, moved_at
      FROM file_moves
      WHERE project_id = ${project_id}
      ORDER BY moved_at DESC
    `;
    return { moves };
  }
);
