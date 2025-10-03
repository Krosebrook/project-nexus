import { api } from "encore.dev/api";
import db from "../db";
import type { RollbackRequest, DeploymentLog } from "./types";

export const rollback = api(
  { method: "POST", path: "/deployments/:id/rollback", expose: true },
  async ({ id, reason }: RollbackRequest & { id: number }): Promise<DeploymentLog> => {

    
    const originalDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${id}
    `;
    
    if (!originalDeployment) {
      throw new Error("Deployment not found");
    }
    
    if (originalDeployment.status === "rolled_back") {
      throw new Error("Deployment already rolled back");
    }
    
    await db.exec`
      UPDATE deployment_logs 
      SET status = 'rolled_back', updated_at = NOW()
      WHERE id = ${id}
    `;
    
    const rollbackDeployment = await db.queryRow<DeploymentLog>`
      INSERT INTO deployment_logs (
        project_id,
        environment_id,
        status,
        stage,
        progress,
        logs,
        rollback_from_deployment_id,
        metadata,
        started_at
      ) VALUES (
        ${originalDeployment.project_id},
        ${originalDeployment.environment_id},
        'in_progress',
        'rollback',
        0,
        ${`Initiating rollback. Reason: ${reason || "Manual rollback"}`},
        ${id},
        ${JSON.stringify({ reason })},
        NOW()
      )
      RETURNING *
    `;
    
    if (!rollbackDeployment) {
      throw new Error("Failed to create rollback deployment");
    }
    
    return rollbackDeployment;
  }
);

export const autoDetectFailure = async (deploymentId: number): Promise<boolean> => {
  
  const deployment = await db.queryRow<DeploymentLog>`
    SELECT * FROM deployment_logs WHERE id = ${deploymentId}
  `;
  
  if (!deployment) {
    return false;
  }
  
  const failures = [
    deployment.error_message && deployment.error_message.includes("critical"),
    deployment.status === "failed" && deployment.stage === "health_check",
    deployment.progress === 0 && 
      deployment.started_at && 
      new Date().getTime() - new Date(deployment.started_at).getTime() > 300000
  ];
  
  return failures.some(f => f);
};