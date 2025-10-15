import { api } from "encore.dev/api";
import db from "../db";
import type { WidgetTemplate } from "./types";

export const listTemplates = api(
  { method: "GET", path: "/widgets/templates", expose: true },
  async (): Promise<{ templates: WidgetTemplate[] }> => {
    const templates = await db.queryAll<WidgetTemplate>`
      SELECT * FROM widget_templates
      WHERE is_public = true
      ORDER BY category, name
    `;

    return { templates };
  }
);