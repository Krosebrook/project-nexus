import { api } from "encore.dev/api";
import db from "../db";
import type { ActivityLog, LogActivityRequest } from "./types";

export const logActivity = api(
  { method: "POST", path: "/collaboration/activity", expose: true },
  async (req: LogActivityRequest): Promise<ActivityLog> => {
    const result = await db.queryRow<ActivityLog>`
      INSERT INTO activity_log (
        project_id, user_id, action_type, entity_type,
        entity_id, description, metadata
      )
      VALUES (
        ${req.project_id || null},
        ${req.user_id || null},
        ${req.action_type},
        ${req.entity_type || null},
        ${req.entity_id || null},
        ${req.description},
        ${JSON.stringify(req.metadata || {})}::jsonb
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to log activity");
    }

    return result;
  }
);

export const listActivity = api(
  { method: "GET", path: "/collaboration/activity", expose: true },
  async ({ project_id, limit }: { project_id?: number; limit?: number }): Promise<{ activities: ActivityLog[] }> => {
    const limitVal = limit || 50;
    
    let query = `
      SELECT 
        al.*,
        row_to_json(u.*) as user
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const params: any[] = [];

    if (project_id) {
      query += ` WHERE al.project_id = $1`;
      params.push(project_id);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limitVal);

    const activities = await db.rawQueryAll(query, ...params) as ActivityLog[];

    return { activities };
  }
);