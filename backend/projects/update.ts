import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { Project, ProjectStatus } from "./types";

interface UpdateProjectParams {
  id: number;
}

interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  health_score?: number;
  metrics?: Record<string, any>;
}

// Updates project metadata.
export const update = api<UpdateProjectRequest & UpdateProjectParams, Project>(
  { expose: true, method: "PUT", path: "/projects/:id" },
  async ({ id, name, description, status, health_score, metrics }) => {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (health_score !== undefined) {
      updates.push(`health_score = $${paramIndex++}`);
      values.push(health_score);
    }
    if (metrics !== undefined) {
      updates.push(`metrics = $${paramIndex++}`);
      values.push(JSON.stringify(metrics));
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("no fields to update");
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`last_activity = NOW()`);
    values.push(id);

    const query = `
      UPDATE projects
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, description, status, health_score, last_activity, metrics, created_at, updated_at
    `;

    const project = await db.rawQueryRow<Project>(query, ...values);
    if (!project) {
      throw APIError.notFound("project not found");
    }
    return project;
  }
);
