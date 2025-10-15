import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { DashboardWidget, UpdateWidgetRequest } from "./types";

export const update = api(
  { method: "PATCH", path: "/widgets/:widget_id", expose: true },
  async (req: UpdateWidgetRequest): Promise<DashboardWidget> => {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (req.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      params.push(req.title);
    }

    if (req.config !== undefined) {
      updates.push(`config = $${paramCount++}::jsonb`);
      params.push(JSON.stringify(req.config));
    }

    if (req.position !== undefined) {
      updates.push(`position = $${paramCount++}::jsonb`);
      params.push(JSON.stringify(req.position));
    }

    if (req.is_visible !== undefined) {
      updates.push(`is_visible = $${paramCount++}`);
      params.push(req.is_visible);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.widget_id);

    const query = `
      UPDATE dashboard_widgets
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.rawQueryRow(query, ...params) as DashboardWidget | null;

    if (!result) {
      throw APIError.notFound("Widget not found");
    }

    return result;
  }
);