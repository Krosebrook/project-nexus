import db from "../db";
import type { DeploymentLog } from "./types";
import { createDeploymentStateMachine, executeDeployment } from "../../services/deployments/statechart/deployment.flow";

export type DeploymentStage = 
  | 'validation'
  | 'build'
  | 'testing'
  | 'migration'
  | 'deployment'
  | 'health_check'
  | 'complete';

export interface DeploymentContext {
  deploymentId: number;
  projectId: number;
  environmentId: number;
  userId?: number;
  config?: Record<string, any>;
}

export class DeploymentStateMachine {
  async execute(context: DeploymentContext): Promise<DeploymentLog> {
    const initialDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${context.deploymentId}
    `;
    
    if (!initialDeployment) {
      throw new Error(`Deployment ${context.deploymentId} not found at start`);
    }

    await executeDeployment(context);
    
    const finalDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${context.deploymentId}
    `;
    
    if (!finalDeployment) {
      throw new Error("Deployment not found after completion");
    }
    
    return finalDeployment;
  }
}
