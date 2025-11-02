import { api } from "encore.dev/api";
import { projectService } from "./service";

export interface DeleteProjectRequest {
  id: number;
}

export interface DeleteProjectResponse {
  success: boolean;
}

export const deleteProject = api<DeleteProjectRequest, DeleteProjectResponse>(
  { method: "DELETE", path: "/projects/:id", expose: true },
  async (req) => {
    await projectService.delete(req.id);
    return { success: true };
  }
);
