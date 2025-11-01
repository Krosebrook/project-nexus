import database from "./index";

export async function getProjectById(projectId: number) {
  return database.queryRow<{ id: number; name: string }>`
    SELECT id, name FROM projects WHERE id = ${projectId}
  `;
}

export async function getEnvironmentById(environmentId: number) {
  return database.queryRow<{ id: number; name: string }>`
    SELECT id, name FROM environments WHERE id = ${environmentId}
  `;
}

export async function createDeploymentLog(
  projectId: number,
  environmentId: number
) {
  return database.queryRow<{ id: number }>`
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
      ${projectId}, 
      ${environmentId}, 
      'in_progress', 
      'validation', 
      0,
      NOW(),
      'Starting deployment...\n'
    )
    RETURNING id
  `;
}

export async function updateDeploymentStage(
  deploymentId: number,
  stage: string,
  progress: number,
  logs?: string,
  stateSnapshot?: Record<string, unknown>
) {
  if (logs && stateSnapshot) {
    await database.exec`
      UPDATE deployment_logs
      SET 
        stage = ${stage}, 
        progress = ${progress}, 
        logs = COALESCE(logs, '') || ${logs},
        state_snapshot = ${JSON.stringify(stateSnapshot)}::jsonb,
        updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  } else if (logs) {
    await database.exec`
      UPDATE deployment_logs
      SET 
        stage = ${stage}, 
        progress = ${progress}, 
        logs = COALESCE(logs, '') || ${logs},
        updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  } else if (stateSnapshot) {
    await database.exec`
      UPDATE deployment_logs
      SET 
        stage = ${stage}, 
        progress = ${progress}, 
        state_snapshot = ${JSON.stringify(stateSnapshot)}::jsonb,
        updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  } else {
    await database.exec`
      UPDATE deployment_logs
      SET stage = ${stage}, progress = ${progress}, updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  }
}

export async function completeDeployment(deploymentId: number, status: 'success' | 'failure') {
  await database.exec`
    UPDATE deployment_logs
    SET status = ${status}, completed_at = NOW(), updated_at = NOW()
    WHERE id = ${deploymentId}
  `;
}
