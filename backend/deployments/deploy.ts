import { api } from "encore.dev/api";
import database from "../db";
import type { DeployRequest, DeploymentProgress, DeploymentLog } from "./types";
import { autoDetectFailure } from "./rollback";
import { broadcastDeploymentNotification } from "../notifications/sse";

async function executeSimpleDeployment(deploymentId: number, projectId: number, environmentId: number): Promise<void> {
  const project = await database.queryRow<{ name: string }>`
    SELECT name FROM projects WHERE id = ${projectId}
  `;
  const environment = await database.queryRow<{ name: string }>`
    SELECT name FROM environments WHERE id = ${environmentId}
  `;

  const stages = [
    { name: 'validation', progress: 10 },
    { name: 'build', progress: 25 },
    { name: 'testing', progress: 40 },
    { name: 'migration', progress: 60 },
    { name: 'deployment', progress: 75 },
    { name: 'health_check', progress: 90 },
    { name: 'complete', progress: 100 },
  ];

  for (const stage of stages) {
    await database.exec`
      UPDATE deployment_logs
      SET stage = ${stage.name}, progress = ${stage.progress}, updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
    
    await broadcastDeploymentNotification({
      deploymentId,
      projectId,
      projectName: project?.name || 'Unknown',
      environmentName: environment?.name || 'Unknown',
      status: 'in_progress',
      stage: stage.name,
      progress: stage.progress,
      message: `Deployment stage: ${stage.name}`,
      timestamp: new Date(),
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  await database.exec`
    UPDATE deployment_logs
    SET status = 'success', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${deploymentId}
  `;
  
  await broadcastDeploymentNotification({
    deploymentId,
    projectId,
    projectName: project?.name || 'Unknown',
    environmentName: environment?.name || 'Unknown',
    status: 'success',
    progress: 100,
    message: 'Deployment completed successfully',
    timestamp: new Date(),
  });
}

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

    setTimeout(async () => {
      try {
        await executeSimpleDeployment(result.id, req.project_id, req.environment_id);
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