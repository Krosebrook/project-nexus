import { api } from "encore.dev/api";
import database from "../db";
import type { DeployRequest, DeploymentProgress, DeploymentLog } from "./types";
import { autoDetectFailure } from "./rollback";
import { broadcastDeploymentNotification } from "../notifications/sse";
import { LogPhrases } from "./log-catalog";

async function executeSimpleDeployment(deploymentId: number, projectId: number, environmentId: number): Promise<void> {
  const project = await database.queryRow<{ name: string }>`
    SELECT name FROM projects WHERE id = ${projectId}
  `;
  const environment = await database.queryRow<{ name: string }>`
    SELECT name FROM environments WHERE id = ${environmentId}
  `;

  const stages = [
    { name: 'validation', progress: 10, legacyLog: LogPhrases.VALIDATING_LEGACY, startLog: LogPhrases.VALIDATING_START, doneLog: LogPhrases.VALIDATING_DONE },
    { name: 'build', progress: 25, startLog: LogPhrases.BUILD_START, doneLog: LogPhrases.BUILD_DONE },
    { name: 'testing', progress: 40, startLog: LogPhrases.TESTS_START, doneLog: LogPhrases.TESTS_DONE },
    { name: 'migration', progress: 60, startLog: LogPhrases.MIGRATIONS_START, doneLog: LogPhrases.MIGRATIONS_DONE },
    { name: 'deployment', progress: 75, startLog: LogPhrases.DEPLOY_START, doneLog: LogPhrases.DEPLOY_DONE },
    { name: 'health_check', progress: 90, startLog: LogPhrases.HEALTH_START, doneLog: LogPhrases.HEALTH_DONE },
    { name: 'complete', progress: 100 },
  ];

  for (const stage of stages) {
    const logMessages: string[] = [];
    if (stage.legacyLog) logMessages.push(stage.legacyLog);
    if (stage.startLog) logMessages.push(stage.startLog);
    
    const stateSnapshot = {
      stage: stage.name,
      status: 'start',
      timestamp: new Date().toISOString(),
    };

    if (logMessages.length > 0) {
      await database.exec`
        UPDATE deployment_logs
        SET 
          stage = ${stage.name}, 
          progress = ${stage.progress}, 
          logs = COALESCE(logs, '') || ${logMessages.join('\n') + '\n'},
          state_snapshot = ${JSON.stringify(stateSnapshot)}::jsonb,
          updated_at = NOW()
        WHERE id = ${deploymentId}
      `;
    } else {
      await database.exec`
        UPDATE deployment_logs
        SET stage = ${stage.name}, progress = ${stage.progress}, updated_at = NOW()
        WHERE id = ${deploymentId}
      `;
    }
    
    await broadcastDeploymentNotification({
      deploymentId,
      projectId,
      projectName: project?.name || 'Unknown',
      environmentName: environment?.name || 'Unknown',
      status: 'in_progress',
      stage: stage.name,
      progress: stage.progress,
      message: stage.startLog || `Deployment stage: ${stage.name}`,
      timestamp: new Date(),
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));

    if (stage.doneLog) {
      const doneSnapshot = {
        stage: stage.name,
        status: 'done',
        timestamp: new Date().toISOString(),
      };
      await database.exec`
        UPDATE deployment_logs
        SET 
          logs = COALESCE(logs, '') || ${stage.doneLog + '\n'},
          state_snapshot = ${JSON.stringify(doneSnapshot)}::jsonb,
          updated_at = NOW()
        WHERE id = ${deploymentId}
      `;
    }
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