import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";

export function useWidgets(userId: string, projectId?: number) {
  return useQuery({
    queryKey: ["widgets", userId, projectId],
    queryFn: async () => {
      const response = await backend.widgets.list({ user_id: userId, project_id: projectId });
      return response.widgets;
    },
    enabled: !!userId
  });
}

export function useWidgetData(widgetId: number) {
  return useQuery({
    queryKey: ["widgets", widgetId, "data"],
    queryFn: async () => {
      return await backend.widgets.getData({ widget_id: widgetId });
    },
    enabled: !!widgetId,
    refetchInterval: 30000
  });
}

export function useWidgetTemplates() {
  return useQuery({
    queryKey: ["widget-templates"],
    queryFn: async () => {
      const response = await backend.widgets.listTemplates();
      return response.templates;
    },
    staleTime: 1000 * 60 * 60
  });
}

export function useCreateWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      user_id: string;
      project_id?: number;
      widget_type: string;
      title: string;
      config?: Record<string, any>;
    }) => {
      return await backend.widgets.create(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["widgets", variables.user_id] });
    }
  });
}

export function useUpdateWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      widget_id: number;
      title?: string;
      config?: Record<string, any>;
      position?: { x: number; y: number; w: number; h: number };
      is_visible?: boolean;
    }) => {
      return await backend.widgets.update(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
    }
  });
}

export function useDeleteWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (widgetId: number) => {
      await backend.widgets.deleteWidget({ widget_id: widgetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
    }
  });
}