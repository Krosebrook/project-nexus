import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { ProjectMember, AddMemberRequest } from "./types";

export const addMember = api(
  { method: "POST", path: "/collaboration/members", expose: true },
  async (req: AddMemberRequest): Promise<ProjectMember> => {
    const result = await db.queryRow<ProjectMember>`
      INSERT INTO project_members (
        project_id, user_id, role, permissions, invited_by
      )
      VALUES (
        ${req.project_id},
        ${req.user_id},
        ${req.role || "member"},
        ${JSON.stringify(req.permissions || {})}::jsonb,
        ${req.invited_by || null}
      )
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to add member");
    }

    return result;
  }
);

export const listMembers = api(
  { method: "GET", path: "/collaboration/projects/:project_id/members", expose: true },
  async ({ project_id }: { project_id: number }): Promise<{ members: ProjectMember[] }> => {
    const members = await db.queryAll<ProjectMember>`
      SELECT 
        pm.*,
        row_to_json(u.*) as user
      FROM project_members pm
      LEFT JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ${project_id}
      ORDER BY pm.joined_at
    `;

    return { members };
  }
);

export const removeMember = api(
  { method: "DELETE", path: "/collaboration/members/:id", expose: true },
  async ({ id }: { id: number }): Promise<void> => {
    await db.exec`
      DELETE FROM project_members WHERE id = ${id}
    `;
  }
);