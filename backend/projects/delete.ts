import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface DeleteProjectRequest {
  id: number;
}

export interface DeleteProjectResponse {
  success: boolean;
}

export const deleteProject = api<DeleteProjectRequest, DeleteProjectResponse>(
  { method: "DELETE", path: "/projects/:id", expose: true },
  async (req) => {
    const result = await db.queryRow<{ id: number }>`
      DELETE FROM projects WHERE id = ${req.id} RETURNING id
    `;

    if (!result) {
      throw APIError.notFound("project not found");
    }

    return { success: true };
  }
);
