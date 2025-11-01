import { api } from "encore.dev/api";
import type { DeployRequest, DeploymentProgress } from "./types";
import { autoDetectFailure } from "./rollback";
import { createDeploymentLog } from "../db/queries";
import { executeDeployment } from "./orchestrator";



export const deploy = api(
  { method: "POST", path: "/deployments/deploy", expose: true },
  async (req: DeployRequest): Promise<DeploymentProgress> => {
    const result = await createDeploymentLog(req.project_id, req.environment_id);
    
    if (!result) {
      throw new Error('Failed to create deployment');
    }

    setTimeout(async () => {
      try {
        await executeDeployment(result.id, req.project_id, req.environment_id);
      } catch (error) {
        const shouldRollback = await autoDetectFailure(result.id);
        
        if (shouldRollback) {
          const { rollback } = await import("./rollback");
          await rollback({ deployment_id: result.id, id: result.id, reason: "Automatic rollback due to deployment failure" });
        }
      }
    }, 100);

    return {
      id: result.id,
      status: 'in_progress',
      stage: 'validation',
      progress: 0,
      logs: 'Starting deployment...\n'
    };
  }
);