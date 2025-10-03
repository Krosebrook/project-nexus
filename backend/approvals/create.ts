import { api } from "encore.dev/api";
import db from "../db";
import type { DeploymentApproval, CreateApprovalRequest } from "./types";

export const create = api(
  { method: "POST", path: "/approvals", expose: true },
  async (req: CreateApprovalRequest): Promise<DeploymentApproval> => {
    const result = await db.queryRow<DeploymentApproval>`
      INSERT INTO deployment_approvals (
        deployment_id,
        required_approvals,
        created_by,
        expires_at,
        metadata
      )
      VALUES (
        ${req.deployment_id},
        ${req.required_approvals || 1},
        ${req.created_by || null},
        ${req.expires_at || null},
        ${JSON.stringify(req.metadata || {})}::jsonb
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create approval");
    }

    return result;
  }
);