import { api } from "encore.dev/api";
import db from "../db";
import type { DeploymentApproval } from "./types";

interface ListRequest {
  deployment_id?: number;
  status?: string;
  limit?: number;
}

export const list = api(
  { method: "GET", path: "/approvals", expose: true },
  async (req: ListRequest): Promise<{ approvals: DeploymentApproval[] }> => {
    let query = `SELECT * FROM deployment_approvals`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (req.deployment_id) {
      conditions.push(`deployment_id = $${params.length + 1}`);
      params.push(req.deployment_id);
    }

    if (req.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(req.status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(req.limit || 50);

    const approvals = await db.rawQueryAll(query, ...params) as DeploymentApproval[];

    return { approvals };
  }
);