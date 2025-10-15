import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";

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

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; status?: string }) => {
      return await backend.projects.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      id: number; 
      name?: string; 
      description?: string; 
      status?: "active" | "development" | "maintenance" | "archived";
      health_score?: number;
      metrics?: Record<string, any>;
    }) => {
      return await backend.projects.update(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", variables.id] });
    }
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await backend.projects.deleteProject({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });
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