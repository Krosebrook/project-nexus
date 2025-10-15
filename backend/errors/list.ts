import { api } from "encore.dev/api";
import db from "../db";
import type { ErrorLog } from "./types";

interface ListRequest {
  user_id?: string;
  error_type?: string;
  severity?: string;
  is_resolved?: boolean;
  limit?: number;
  offset?: number;
}

export const list = api(
  { method: "GET", path: "/errors", expose: true },
  async (req: ListRequest): Promise<{ errors: ErrorLog[]; total: number }> => {
    let query = `SELECT * FROM error_logs`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (req.user_id) {
      conditions.push(`user_id = $${params.length + 1}`);
      params.push(req.user_id);
    }

    if (req.error_type) {
      conditions.push(`error_type = $${params.length + 1}`);
      params.push(req.error_type);
    }

    if (req.severity) {
      conditions.push(`severity = $${params.length + 1}`);
      params.push(req.severity);
    }

    if (req.is_resolved !== undefined) {
      conditions.push(`is_resolved = $${params.length + 1}`);
      params.push(req.is_resolved);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(req.limit || 50, req.offset || 0);

    const errors = await db.rawQueryAll(query, ...params);

    let countQuery = `SELECT COUNT(*) as count FROM error_logs`;
    const countParams: any[] = [];
    
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
      for (let i = 0; i < conditions.length; i++) {
        if (req.user_id && conditions[i].includes('user_id')) countParams.push(req.user_id);
        if (req.error_type && conditions[i].includes('error_type')) countParams.push(req.error_type);
        if (req.severity && conditions[i].includes('severity')) countParams.push(req.severity);
        if (req.is_resolved !== undefined && conditions[i].includes('is_resolved')) countParams.push(req.is_resolved);
      }
    }

    const countResult = await db.rawQueryRow(countQuery, ...countParams);

    return {
      errors: errors as ErrorLog[],
      total: Number(countResult?.count || 0)
    };
  }
);