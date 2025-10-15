import { api } from "encore.dev/api";
import db from "../db";
import type { AlertHistory } from "./advanced_types";

interface CreateHistoryRequest {
  alert_rule_id: number;
  severity: "info" | "warning" | "error" | "critical";
  metric_value?: number;
  threshold_value?: number;
  message: string;
  metadata?: Record<string, any>;
  actions_taken?: any[];
}

export const createHistory = api(
  { method: "POST", path: "/alerts/history", expose: true },
  async (req: CreateHistoryRequest): Promise<AlertHistory> => {
    const result = await db.queryRow<AlertHistory>`
      INSERT INTO alert_history (
        alert_rule_id,
        severity,
        metric_value,
        threshold_value,
        message,
        metadata,
        actions_taken
      )
      VALUES (
        ${req.alert_rule_id},
        ${req.severity},
        ${req.metric_value || null},
        ${req.threshold_value || null},
        ${req.message},
        ${JSON.stringify(req.metadata || {})}::jsonb,
        ${JSON.stringify(req.actions_taken || [])}::jsonb
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create alert history");
    }

    await db.exec`
      UPDATE alert_rules
      SET last_triggered = NOW()
      WHERE id = ${req.alert_rule_id}
    `;

    return result;
  }
);

export const listHistory = api(
  { method: "GET", path: "/alerts/history", expose: true },
  async ({ alert_rule_id, limit }: { alert_rule_id?: number; limit?: number }): Promise<{ history: AlertHistory[] }> => {
    let query = `SELECT * FROM alert_history`;
    const params: any[] = [];

    if (alert_rule_id) {
      query += ` WHERE alert_rule_id = $1`;
      params.push(alert_rule_id);
    }

    query += ` ORDER BY triggered_at DESC LIMIT $${params.length + 1}`;
    params.push(limit || 100);

    const history = await db.rawQueryAll(query, ...params) as AlertHistory[];

    return { history };
  }
);

export const resolveAlert = api(
  { method: "PATCH", path: "/alerts/history/:history_id/resolve", expose: true },
  async ({ history_id }: { history_id: number }): Promise<AlertHistory> => {
    const result = await db.queryRow<AlertHistory>`
      UPDATE alert_history
      SET resolved_at = NOW()
      WHERE id = ${history_id}
      RETURNING *
    `;

    if (!result) {
      throw new Error("Alert history not found");
    }

    return result;
  }
);