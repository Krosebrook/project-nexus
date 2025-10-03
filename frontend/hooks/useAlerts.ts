import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";

export function useAlerts(projectId?: number) {
  return useQuery({
    queryKey: projectId ? ["alerts", { projectId }] : ["alerts"],
    queryFn: async () => {
      const response = await backend.alerts.list({ project_id: projectId || 0 });
      return response.alerts;
    }
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      project_id: number;
      name: string;
      condition: string;
      threshold: number;
      notification_channel: string;
    }) => {
      return await backend.alerts.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    }
  });
}

export function useToggleAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      return await backend.alerts.toggle({ id, enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    }
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await backend.alerts.deleteRule({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    }
  });
}