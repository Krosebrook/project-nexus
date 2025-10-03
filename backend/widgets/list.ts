import { api } from "encore.dev/api";
import db from "../db";
import type { DashboardWidget } from "./types";

interface ListRequest {
  user_id: string;
  project_id?: number;
}

export const list = api(
  { method: "GET", path: "/widgets", expose: true },
  async (req: ListRequest): Promise<{ widgets: DashboardWidget[] }> => {
    let query = `
      SELECT * FROM dashboard_widgets
      WHERE user_id = $1
    `;
    const params: any[] = [req.user_id];

    if (req.project_id) {
      query += ` AND (project_id = $2 OR project_id IS NULL)`;
      params.push(req.project_id);
    }

    query += ` ORDER BY position->>'y', position->>'x'`;

    const widgets = await db.rawQueryAll(query, ...params) as DashboardWidget[];

    return { widgets };
  }
);