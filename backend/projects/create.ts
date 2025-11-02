import { api } from "encore.dev/api";
import { projectService } from "./service";
import type { Project } from "./types";

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: string;
}

export const create = api<CreateProjectRequest, Project>(
  { method: "POST", path: "/projects", expose: true },
  async (req) => {
    return projectService.create(req);
  }
);
