import { api } from "encore.dev/api";
import db from "../db";
import type { DeleteSnapshotRequest } from "./types";

export const del = api(
  { method: "DELETE", path: "/snapshots/:id", expose: true },
  async ({ id }: DeleteSnapshotRequest): Promise<{ success: boolean }> => {
    await db.exec`
      DELETE FROM context_snapshots
      WHERE id = ${id}
    `;
    return { success: true };
  }
);