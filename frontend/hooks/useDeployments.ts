import backend from "~backend/client";
import { useBaseQuery, useBaseMutation } from "./useBaseQuery";

export function useDeployments(projectId?: number) {
  return useBaseQuery(
    projectId ? ["deployments", String(projectId)] : ["deployments"],
    async () => [],
    { showErrorToast: false }
  );
}

export function useDeploymentStatus(deploymentId: number) {
  return useBaseQuery(
    ["deployments", String(deploymentId), "status"],
    async () => backend.deployments.status({ id: deploymentId }),
    {
      enabled: !!deploymentId,
      refetchInterval: 5000,
    }
  );
}

export function useCreateDeployment() {
  return useBaseMutation(
    async (data: {
      project_id: number;
      environment_id: number;
      checklist: {
        tests_passed: boolean;
        breaking_changes_documented: boolean;
        migrations_ready: boolean;
      };
    }) => backend.deployments.deploy(data),
    {
      successMessage: "Deployment created successfully",
      invalidateQueries: [["deployments"]],
    }
  );
}

export function useDeploymentLogs(projectId: number) {
  return useBaseQuery(
    ["deployments", String(projectId), "logs"],
    async () => backend.deployments.logs({ project_id: projectId }),
    { enabled: !!projectId }
  );
}