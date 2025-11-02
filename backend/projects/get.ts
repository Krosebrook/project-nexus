import { api } from "encore.dev/api";
import { projectService } from "./service";
import type { Project } from "./types";

interface GetProjectParams {
  id: number;
}

export const get = api<GetProjectParams, Project>(
  { expose: true, method: "GET", path: "/projects/:id" },
  async ({ id }) => {
    return projectService.getById(id);
  }
);
