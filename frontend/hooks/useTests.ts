import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";

export function useTests(projectId?: number) {
  return useQuery({
    queryKey: projectId ? ["tests", { projectId }] : ["tests"],
    queryFn: async () => {
      return [];
    }
  });
}

export function useCreateTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      project_id: number;
      name: string;
      input: Record<string, any>;
      expected_output: Record<string, any>;
    }) => {
      return {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
    }
  });
}

export function useRunTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actual_output }: { id: number; actual_output: Record<string, any> }) => {
      return {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
    }
  });
}

export function useRunAllTests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: number) => {
      return {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
    }
  });
}
