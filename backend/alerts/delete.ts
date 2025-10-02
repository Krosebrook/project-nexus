import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface DeleteAlertRuleRequest {
  id: number;
}

export interface DeleteAlertRuleResponse {
  success: boolean;
}

export const deleteRule = api<DeleteAlertRuleRequest, DeleteAlertRuleResponse>(
  { method: "DELETE", path: "/alerts/:id", expose: true },
  async (req) => {
    const result = await db.queryRow<{ id: number }>`
      DELETE FROM alert_rules WHERE id = ${req.id} RETURNING id
    `;

    if (!result) {
      throw APIError.notFound("alert rule not found");
    }

    return { success: true };
  }
);
