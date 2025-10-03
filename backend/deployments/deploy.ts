import { api } from "encore.dev/api";
import db from "../db";
import type { DeployRequest, DeploymentProgress } from "./types";

export const deploy = api(
  { method: "POST", path: "/deployments/deploy", expose: true },
  async (req: DeployRequest): Promise<DeploymentProgress> => {
    const result = await db.queryRow<{ id: number }>`
      INSERT INTO deployment_logs (project_id, environment, status, stage, progress, logs)
      VALUES (${req.project_id}, ${req.environment}, 'running', 'build', 0, 'Starting deployment...\n')
      RETURNING id
    `;
    if (!result) throw new Error('Failed to create deployment');

    setTimeout(async () => {
      await simulateDeployment(result.id);
    }, 100);

    return {
      id: result.id,
      status: 'running',
      stage: 'build',
      progress: 0,
      logs: 'Starting deployment...\n'
    };
  }
);

async function simulateDeployment(deploymentId: number) {
  const stages = [
    { stage: 'build', duration: 3000, progress: 33 },
    { stage: 'test', duration: 2000, progress: 66 },
    { stage: 'deploy', duration: 2000, progress: 100 }
  ];

  for (const { stage, duration, progress } of stages) {
    await new Promise(resolve => setTimeout(resolve, duration));
    await db.exec`
      UPDATE deployment_logs
      SET stage = ${stage}, progress = ${progress}, 
          logs = logs || ${`${stage} stage completed\n`}
      WHERE id = ${deploymentId}
    `;
  }

  await db.exec`
    UPDATE deployment_logs
    SET status = 'success'
    WHERE id = ${deploymentId}
  `;
}