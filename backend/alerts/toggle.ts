import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { AlertRule } from "./types";

interface ToggleAlertParams {
  id: number;
}

interface ToggleAlertRequest {
  enabled: boolean;
}

// Toggles an alert rule on or off.
export const toggle = api<ToggleAlertRequest & ToggleAlertParams, AlertRule>(
  { expose: true, method: "PUT", path: "/alerts/:id/toggle" },
  async ({ id, enabled }) => {
    if (typeof enabled !== "boolean") {
      throw APIError.invalidArgument("enabled must be a boolean");
    }
    const alert = await db.queryRow<AlertRule>`
      UPDATE alert_rules
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, project_id, name, condition, threshold, notification_channel, enabled, last_triggered, created_at, updated_at
    `;
    if (!alert) {
      throw APIError.notFound("alert rule not found");
    }
    return alert;
  }
);
