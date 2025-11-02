import backend from "~backend/client";
import type { Project } from "~backend/projects/types";
import { useBaseCRUD, useBaseQuery } from "./useBaseQuery";

export function useProjects() {
  return useBaseQuery(
    ["projects"],
    async () => {
      const response = await backend.projects.list();
      return response.projects;
    },
    { staleTime: 30000 }
  );
}

export function useProject(id: number) {
  return useBaseQuery(
    ["projects", String(id)],
    async () => backend.projects.get({ id }),
    { enabled: !!id }
  );
}

export function useProjectCRUD() {
  return useBaseCRUD<
    Project,
    { name: string; description?: string; status?: string },
    {
      id: number;
      name?: string;
      description?: string;
      status?: "active" | "development" | "maintenance" | "archived";
      health_score?: number;
      metrics?: Record<string, any>;
    }
  >({
    queryKey: ["projects"],
    listFn: async () => {
      const response = await backend.projects.list();
      return response.projects;
    },
    getFn: async (id: number) => backend.projects.get({ id }),
    createFn: async (data) => backend.projects.create(data),
    updateFn: async (data) => backend.projects.update(data),
    deleteFn: async (id: number) => {
      await backend.projects.deleteProject({ id });
    },
    entityName: "Project",
  });
}

export function useCreateProject() {
  const crud = useProjectCRUD();
  return crud.create!;
}

export function useUpdateProject() {
  const crud = useProjectCRUD();
  return crud.update!;
}

export function useDeleteProject() {
  const crud = useProjectCRUD();
  return crud.delete!;
}

export function useProjectMetrics(projectId: number) {
  return useBaseQuery(
    ["projects", String(projectId), "metrics"],
    async () => {
      const project = await backend.projects.get({ id: projectId });
      return project.metrics || {};
    },
    {
      enabled: !!projectId,
      refetchInterval: 30000,
    }
  );
}