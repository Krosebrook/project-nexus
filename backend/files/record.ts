import { api } from "encore.dev/api";
import db from "../db";
import type { FileMove } from "./types";

interface RecordMoveRequest {
  project_id: number;
  original_path: string;
  new_path: string;
  reason?: string;
}

// Records a file move operation.
export const record = api<RecordMoveRequest, FileMove>(
  { expose: true, method: "POST", path: "/files/moves" },
  async ({ project_id, original_path, new_path, reason }) => {
    const move = await db.queryRow<FileMove>`
      INSERT INTO file_moves (project_id, original_path, new_path, reason)
      VALUES (${project_id}, ${original_path}, ${new_path}, ${reason ?? null})
      RETURNING id, project_id, original_path, new_path, reason, moved_at
    `;
    return move!;
  }
);
