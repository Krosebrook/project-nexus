import { api } from "encore.dev/api";
import db from "../db";
import type { ContextSnapshot } from "./types";

export const list = api(
  { method: "GET", path: "/snapshots", expose: true },
  async (): Promise<{ snapshots: ContextSnapshot[] }> => {
    const rows = await db.query<ContextSnapshot>`
      SELECT * FROM context_snapshots
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const snapshots: ContextSnapshot[] = [];
    for await (const row of rows) {
      snapshots.push(row);
    }
    return { snapshots };
  }
);