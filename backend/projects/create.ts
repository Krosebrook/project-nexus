import { api, APIError } from "encore.dev/api";
import db from "../db";
import { validateProjectName } from "../db/helpers";
import type { Project } from "./types";

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: string;
}

export const create = api<CreateProjectRequest, Project>(
  { method: "POST", path: "/projects", expose: true },
  async (req) => {
    if (!req.name?.trim()) {
      throw APIError.invalidArgument("name is required");
    }

    const status = req.status || "active";
    const validStatuses = ["active", "development", "maintenance", "archived"];
    if (!validStatuses.includes(status)) {
      throw APIError.invalidArgument(`status must be one of: ${validStatuses.join(", ")}`);
    }

    await validateProjectName(req.name);

    const result = await db.queryRow<Project>`
      INSERT INTO projects (name, description, status)
      VALUES (${req.name}, ${req.description || null}, ${status})
      RETURNING *
    `;

    return result!;
  }
);
