import { api } from "encore.dev/api";
import db from "../db";
import type { DashboardWidget, CreateWidgetRequest } from "./types";
import { WidgetSchema, validateSchema } from "../shared/validation";

export const create = api(
  { method: "POST", path: "/widgets", expose: true },
  async (req: CreateWidgetRequest): Promise<DashboardWidget> => {
    validateSchema(WidgetSchema, req);
    const result = await db.queryRow<DashboardWidget>`
      INSERT INTO dashboard_widgets (
        user_id, project_id, widget_type, title, config, position
      )
      VALUES (
        ${req.user_id},
        ${req.project_id || null},
        ${req.widget_type},
        ${req.title},
        ${JSON.stringify(req.config || {})}::jsonb,
        ${JSON.stringify(req.position || { x: 0, y: 0, w: 4, h: 3 })}::jsonb
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create widget");
    }

    return result;
  }
);