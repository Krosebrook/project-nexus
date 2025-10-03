import { api } from "encore.dev/api";
import database from "../db";
import type { DeployRequest, DeploymentProgress, DeploymentLog } from "./types";
import { DeploymentStateMachine } from "./state-machine";
import { autoDetectFailure } from "./rollback";

export const deploy = api(
  { method: "POST", path: "/deployments/deploy", expose: true },
  async (req: DeployRequest): Promise<DeploymentProgress> => {
    const result = await database.queryRow<{ id: number }>`
      INSERT INTO deployment_logs (
        project_id, 
        environment_id, 
        status, 
        stage, 
        progress,
        started_at,
        logs
      )
      VALUES (
        ${req.project_id}, 
        ${req.environment_id}, 
        'in_progress', 
        'validation', 
        0,
        NOW(),
        'Starting deployment...\n'
      )
      RETURNING id
    `;
    
    if (!result) {
      throw new Error('Failed to create deployment');
    }

    const stateMachine = new DeploymentStateMachine();
    
    setTimeout(async () => {
      try {
        await stateMachine.execute({
          deploymentId: result.id,
          projectId: req.project_id,
          environmentId: req.environment_id
        });
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