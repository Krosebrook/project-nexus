import { api } from "encore.dev/api";
import db from "../db";
import type { AlertEscalation, CreateEscalationRequest } from "./advanced_types";

export const createEscalation = api(
  { method: "POST", path: "/alerts/escalations", expose: true },
  async (req: CreateEscalationRequest): Promise<AlertEscalation> => {
    const result = await db.queryRow<AlertEscalation>`
      INSERT INTO alert_escalations (
        alert_rule_id,
        escalation_level,
        delay_duration,
        notification_channels,
        user_ids
      )
      VALUES (
        ${req.alert_rule_id},
        ${req.escalation_level},
        ${req.delay_duration},
        ${req.notification_channels}::TEXT[],
        ${req.user_ids || []}::BIGINT[]
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create escalation");
    }

    return result;
  }
);

export const listEscalations = api(
  { method: "GET", path: "/alerts/rules/:alert_rule_id/escalations", expose: true },
  async ({ alert_rule_id }: { alert_rule_id: number }): Promise<{ escalations: AlertEscalation[] }> => {
    const escalations = await db.queryAll<AlertEscalation>`
      SELECT * FROM alert_escalations
      WHERE alert_rule_id = ${alert_rule_id}
      ORDER BY escalation_level
    `;

    return { escalations };
  }
);