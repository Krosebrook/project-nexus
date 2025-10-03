import { api } from "encore.dev/api";
import db from "../db";
import type { UserPresence, UpdatePresenceRequest } from "./types";

export const updatePresence = api(
  { method: "POST", path: "/collaboration/presence", expose: true },
  async (req: UpdatePresenceRequest): Promise<UserPresence> => {
    const result = await db.queryRow<UserPresence>`
      INSERT INTO user_presence (
        user_id, project_id, status, current_page, metadata, last_seen
      )
      VALUES (
        ${req.user_id},
        ${req.project_id || null},
        ${req.status},
        ${req.current_page || null},
        ${JSON.stringify(req.metadata || {})}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        project_id = EXCLUDED.project_id,
        status = EXCLUDED.status,
        current_page = EXCLUDED.current_page,
        metadata = EXCLUDED.metadata,
        last_seen = NOW()
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to update presence");
    }

    return result;
  }
);

export const listPresence = api(
  { method: "GET", path: "/collaboration/presence", expose: true },
  async ({ project_id }: { project_id?: number }): Promise<{ presence: UserPresence[] }> => {
    let query = `
      SELECT 
        up.*,
        row_to_json(u.*) as user
      FROM user_presence up
      LEFT JOIN users u ON up.user_id = u.id
      WHERE up.status != 'offline'
        AND up.last_seen > NOW() - INTERVAL '5 minutes'
    `;
    const params: any[] = [];

    if (project_id) {
      query += ` AND up.project_id = $1`;
      params.push(project_id);
    }

    query += ` ORDER BY up.last_seen DESC`;

    const presence = await db.rawQueryAll(query, ...params) as UserPresence[];

    return { presence };
  }
);