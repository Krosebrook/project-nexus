import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { Project } from "./types";

interface GetProjectParams {
  id: number;
}

// Retrieves a single project by ID.
export const get = api<GetProjectParams, Project>(
  { expose: true, method: "GET", path: "/projects/:id" },
  async ({ id }) => {
    const project = await db.queryRow<Project>`
      SELECT id, name, description, status, health_score, last_activity, metrics, created_at, updated_at
      FROM projects
      WHERE id = ${id}
    `;
    if (!project) {
      throw APIError.notFound("project not found");
    }
    return project;
  }
);
