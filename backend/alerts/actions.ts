import { api } from "encore.dev/api";
import db from "../db";
import type { AlertAction, CreateActionRequest } from "./advanced_types";

export const createAction = api(
  { method: "POST", path: "/alerts/actions", expose: true },
  async (req: CreateActionRequest): Promise<AlertAction> => {
    const result = await db.queryRow<AlertAction>`
      INSERT INTO alert_actions (
        alert_rule_id,
        action_type,
        action_config,
        execution_order
      )
      VALUES (
        ${req.alert_rule_id},
        ${req.action_type},
        ${JSON.stringify(req.action_config)}::jsonb,
        ${req.execution_order || 1}
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create alert action");
    }

    return result;
  }
);

export const listActions = api(
  { method: "GET", path: "/alerts/rules/:alert_rule_id/actions", expose: true },
  async ({ alert_rule_id }: { alert_rule_id: number }): Promise<{ actions: AlertAction[] }> => {
    const actions = await db.queryAll<AlertAction>`
      SELECT * FROM alert_actions
      WHERE alert_rule_id = ${alert_rule_id}
      ORDER BY execution_order
    `;

    return { actions };
  }
);

export const toggleAction = api(
  { method: "PATCH", path: "/alerts/actions/:action_id/toggle", expose: true },
  async ({ action_id, is_enabled }: { action_id: number; is_enabled: boolean }): Promise<AlertAction> => {
    const result = await db.queryRow<AlertAction>`
      UPDATE alert_actions
      SET is_enabled = ${is_enabled}
      WHERE id = ${action_id}
      RETURNING *
    `;

    if (!result) {
      throw new Error("Alert action not found");
    }

    return result;
  }
);