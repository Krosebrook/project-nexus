import { api } from "encore.dev/api";
import db from "../db";
import type { AlertRule } from "./types";

interface ListAlertsParams {
  project_id: number;
}

interface ListAlertsResponse {
  alerts: AlertRule[];
}

// Retrieves all alert rules for a project.
export const list = api<ListAlertsParams, ListAlertsResponse>(
  { expose: true, method: "GET", path: "/alerts/project/:project_id" },
  async ({ project_id }) => {
    const alerts = await db.queryAll<AlertRule>`
      SELECT id, project_id, name, condition, threshold, notification_channel, enabled, last_triggered, created_at, updated_at
      FROM alert_rules
      WHERE project_id = ${project_id}
      ORDER BY created_at DESC
    `;
    return { alerts };
  }
);
