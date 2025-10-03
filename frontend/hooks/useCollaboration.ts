import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";

export function useProjectMembers(projectId: number) {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const response = await backend.collaboration.listMembers({ project_id: projectId });
      return response.members;
    },
    enabled: !!projectId
  });
}

export function useActivityLog(projectId?: number) {
  return useQuery({
    queryKey: projectId ? ["activity", { projectId }] : ["activity"],
    queryFn: async () => {
      const response = await backend.collaboration.listActivity({ project_id: projectId });
      return response.activities;
    }
  });
}

export function useComments(entityType: string, entityId: number) {
  return useQuery({
    queryKey: ["comments", entityType, entityId],
    queryFn: async () => {
      const response = await backend.collaboration.listComments({
        entity_type: entityType,
        entity_id: entityId
      });
      return response.comments;
    },
    enabled: !!entityType && !!entityId
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      project_id: number;
      user_id: number;
      entity_type: string;
      entity_id: number;
      content: string;
      parent_id?: number;
    }) => {
      return await backend.collaboration.createComment(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["comments", variables.entity_type, variables.entity_id]
      });
    }
  });
}

export function useUserPresence(projectId?: number) {
  return useQuery({
    queryKey: projectId ? ["presence", { projectId }] : ["presence"],
    queryFn: async () => {
      const response = await backend.collaboration.listPresence({ project_id: projectId });
      return response.presence;
    },
    refetchInterval: 10000
  });
}