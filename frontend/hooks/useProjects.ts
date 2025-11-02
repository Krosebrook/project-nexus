import { useQuery } from "@tanstack/react-query";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";
import { useGenericCRUD } from "./useGenericCRUD";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await backend.projects.list();
      return response.projects;
    }
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      return await backend.projects.get({ id });
    },
    enabled: !!id
  });
}

const projectCRUD = {
  queryKey: ["projects"],
  listFn: async () => {
    const response = await backend.projects.list();
    return response.projects;
  },
  getFn: async (id: number) => backend.projects.get({ id }),
  createFn: async (data: { name: string; description?: string; status?: string }) =>
    backend.projects.create(data),
  updateFn: async (data: {
    id: number;
    name?: string;
    description?: string;
    status?: "active" | "development" | "maintenance" | "archived";
    health_score?: number;
    metrics?: Record<string, any>;
  }) => backend.projects.update(data),
  deleteFn: async (id: number) => {
    await backend.projects.deleteProject({ id });
  },
};

export function useCreateProject() {
  const crud = useGenericCRUD<
    Project,
    { name: string; description?: string; status?: string },
    {
      name?: string;
      description?: string;
      status?: "active" | "development" | "maintenance" | "archived";
      health_score?: number;
      metrics?: Record<string, any>;
    },
    number
  >(projectCRUD);
  return crud.create!;
}

export function useUpdateProject() {
  const crud = useGenericCRUD<
    Project,
    { name: string; description?: string; status?: string },
    {
      name?: string;
      description?: string;
      status?: "active" | "development" | "maintenance" | "archived";
      health_score?: number;
      metrics?: Record<string, any>;
    },
    number
  >(projectCRUD);
  return crud.update!;
}

export function useDeleteProject() {
  const crud = useGenericCRUD<
    Project,
    { name: string; description?: string; status?: string },
    {
      name?: string;
      description?: string;
      status?: "active" | "development" | "maintenance" | "archived";
      health_score?: number;
      metrics?: Record<string, any>;
    },
    number
  >(projectCRUD);
  return crud.delete!;
}

export function useProjectMetrics(projectId: number) {
  return useQuery({
    queryKey: ["projects", projectId, "metrics"],
    queryFn: async () => {
      const project = await backend.projects.get({ id: projectId });
      return project.metrics || {};
    },
    enabled: !!projectId,
    refetchInterval: 30000
  });
}