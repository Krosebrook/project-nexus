import { api } from "encore.dev/api";
import db from "../db";
import type { AlertCondition, CreateConditionRequest } from "./advanced_types";

export const createCondition = api(
  { method: "POST", path: "/alerts/conditions", expose: true },
  async (req: CreateConditionRequest): Promise<AlertCondition> => {
    const result = await db.queryRow<AlertCondition>`
      INSERT INTO alert_conditions (
        alert_rule_id,
        condition_type,
        metric_name,
        operator,
        threshold_value,
        aggregation,
        time_window,
        evaluation_order
      )
      VALUES (
        ${req.alert_rule_id},
        ${req.condition_type},
        ${req.metric_name},
        ${req.operator},
        ${req.threshold_value},
        ${req.aggregation || "avg"},
        ${req.time_window || "5 minutes"},
        ${req.evaluation_order || 1}
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create alert condition");
    }

    return result;
  }
);

export const listConditions = api(
  { method: "GET", path: "/alerts/rules/:alert_rule_id/conditions", expose: true },
  async ({ alert_rule_id }: { alert_rule_id: number }): Promise<{ conditions: AlertCondition[] }> => {
    const conditions = await db.queryAll<AlertCondition>`
      SELECT * FROM alert_conditions
      WHERE alert_rule_id = ${alert_rule_id}
      ORDER BY evaluation_order
    `;

    return { conditions };
  }
);

export const deleteCondition = api(
  { method: "DELETE", path: "/alerts/conditions/:condition_id", expose: true },
  async ({ condition_id }: { condition_id: number }): Promise<void> => {
    await db.exec`
      DELETE FROM alert_conditions WHERE id = ${condition_id}
    `;
  }
);