import { api } from "encore.dev/api";
import db from "../db";
import type { Project } from "./types";

interface ListProjectsResponse {
  projects: Project[];
}

// Retrieves all projects, ordered by last activity.
export const list = api<void, ListProjectsResponse>(
  { expose: true, method: "GET", path: "/projects" },
  async () => {
    const projects = await db.queryAll<Project>`
      SELECT id, name, description, status, health_score, last_activity, metrics, created_at, updated_at
      FROM projects
      ORDER BY last_activity DESC
    `;
    return { projects };
  }
);
