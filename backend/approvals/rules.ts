import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { ApprovalRule, CreateApprovalRuleRequest } from "./types";

export const createRule = api(
  { method: "POST", path: "/approvals/rules", expose: true },
  async (req: CreateApprovalRuleRequest): Promise<ApprovalRule> => {
    const result = await db.queryRow<ApprovalRule>`
      INSERT INTO approval_rules (
        project_id,
        name,
        description,
        environment,
        required_approvals,
        auto_approve_after,
        allowed_approvers,
        conditions
      )
      VALUES (
        ${req.project_id},
        ${req.name},
        ${req.description || null},
        ${req.environment},
        ${req.required_approvals || 1},
        ${req.auto_approve_after || null},
        ${req.allowed_approvers || []}::BIGINT[],
        ${JSON.stringify(req.conditions || {})}::jsonb
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create approval rule");
    }

    return result;
  }
);

export const listRules = api(
  { method: "GET", path: "/approvals/rules", expose: true },
  async ({ project_id }: { project_id?: number }): Promise<{ rules: ApprovalRule[] }> => {
    let query = `SELECT * FROM approval_rules WHERE is_active = true`;
    const params: any[] = [];

    if (project_id) {
      query += ` AND project_id = $1`;
      params.push(project_id);
    }

    query += ` ORDER BY environment, name`;

    const rules = await db.rawQueryAll(query, ...params) as ApprovalRule[];

    return { rules };
  }
);

export const updateRule = api(
  { method: "PATCH", path: "/approvals/rules/:rule_id", expose: true },
  async ({ rule_id, is_active }: { rule_id: number; is_active?: boolean }): Promise<ApprovalRule> => {
    const result = await db.queryRow<ApprovalRule>`
      UPDATE approval_rules
      SET is_active = ${is_active !== undefined ? is_active : true}, updated_at = NOW()
      WHERE id = ${rule_id}
      RETURNING *
    `;

    if (!result) {
      throw APIError.notFound("Approval rule not found");
    }

    return result;
  }
);