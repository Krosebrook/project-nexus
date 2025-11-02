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
  const updates: string[] = ["stage = $2", "progress = $3", "updated_at = NOW()"];
  const params: any[] = [deploymentId, stage, progress];
  let paramIndex = 4;

  if (logs) {
    updates.push(`logs = COALESCE(logs, '') || $${paramIndex++}`);
    params.push(logs);
  }

  if (stateSnapshot) {
    updates.push(`state_snapshot = $${paramIndex++}::jsonb`);
    params.push(JSON.stringify(stateSnapshot));
  }

  const query = `
    UPDATE deployment_logs
    SET ${updates.join(", ")}
    WHERE id = $1
  `;

  await database.rawExec(query, ...params);
}

export async function completeDeployment(deploymentId: number, status: 'success' | 'failure') {
  await database.exec`
    UPDATE deployment_logs
    SET status = ${status}, completed_at = NOW(), updated_at = NOW()
    WHERE id = ${deploymentId}
  `;
}
