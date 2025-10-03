import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";

export function useDeployments(projectId?: number) {
  return useQuery({
    queryKey: projectId ? ["deployments", { projectId }] : ["deployments"],
    queryFn: async () => {
      return [];
    }
  });
}

export function useDeploymentStatus(deploymentId: number) {
  return useQuery({
    queryKey: ["deployments", deploymentId, "status"],
    queryFn: async () => {
      return await backend.deployments.status({ id: deploymentId });
    },
    enabled: !!deploymentId,
    refetchInterval: 5000
  });
}

export function useCreateDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      project_id: number;
      environment_id: number;
      checklist: {
        tests_passed: boolean;
        breaking_changes_documented: boolean;
        migrations_ready: boolean;
      };
    }) => {
      return await backend.deployments.deploy(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
    }
  });
}

export function useDeploymentLogs(projectId: number) {
  return useQuery({
    queryKey: ["deployments", projectId, "logs"],
    queryFn: async () => {
      return await backend.deployments.logs({ project_id: projectId });
    },
    enabled: !!projectId
  });
}