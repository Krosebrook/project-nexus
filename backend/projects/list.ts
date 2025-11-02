import { api } from "encore.dev/api";
import { projectService } from "./service";
import type { Project } from "./types";

interface ListProjectsResponse {
  projects: Project[];
}

export const list = api<void, ListProjectsResponse>(
  { expose: true, method: "GET", path: "/projects" },
  async () => {
    const projects = await projectService.list();
    return { projects };
  }
);
