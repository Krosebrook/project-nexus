import { api, APIError } from "encore.dev/api";
import db from "../db";
import { validateProjectExists } from "../db/helpers";
import type { AlertRule } from "./types";

export interface CreateAlertRuleRequest {
  project_id: number;
  name: string;
  condition: string;
  threshold: number;
  notification_channel: string;
  enabled?: boolean;
}

export const create = api<CreateAlertRuleRequest, AlertRule>(
  { method: "POST", path: "/alerts", expose: true },
  async (req) => {
    if (!req.name?.trim()) {
      throw APIError.invalidArgument("name is required");
    }
    if (!req.condition?.trim()) {
      throw APIError.invalidArgument("condition is required");
    }
    if (typeof req.threshold !== "number") {
      throw APIError.invalidArgument("threshold must be a number");
    }
    if (!req.notification_channel?.trim()) {
      throw APIError.invalidArgument("notification_channel is required");
    }

    await validateProjectExists(req.project_id);

    const result = await db.queryRow<AlertRule>`
      INSERT INTO alert_rules (project_id, name, condition, threshold, notification_channel, enabled)
      VALUES (${req.project_id}, ${req.name}, ${req.condition}, ${req.threshold}, ${req.notification_channel}, ${req.enabled ?? true})
      RETURNING *
    `;

    return result!;
  }
);
