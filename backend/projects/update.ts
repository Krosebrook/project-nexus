import { api } from "encore.dev/api";
import { projectService } from "./service";
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

export const update = api<UpdateProjectRequest & UpdateProjectParams, Project>(
  { expose: true, method: "PUT", path: "/projects/:id" },
  async ({ id, ...input }) => {
    return projectService.update(id, input);
  }
);
