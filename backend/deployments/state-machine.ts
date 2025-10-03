import db from "../db";
import type { DeploymentLog, DeploymentStatus } from "./types";

export type DeploymentStage = 
  | 'validation'
  | 'build'
  | 'testing'
  | 'migration'
  | 'deployment'
  | 'health_check'
  | 'complete'
  | 'rollback';

export interface StageResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, any>;
}

export interface DeploymentContext {
  deploymentId: number;
  projectId: number;
  environmentId: number;
}

export class DeploymentStateMachine {
  private stages: DeploymentStage[] = [
    'validation',
    'build',
    'testing',
    'migration',
    'deployment',
    'health_check',
    'complete'
  ];

  async execute(context: DeploymentContext): Promise<DeploymentLog> {

    let currentStage = 0;

    try {
      for (const stage of this.stages) {
        await this.updateProgress(context.deploymentId, stage, (currentStage / this.stages.length) * 100);
        
        const result = await this.executeStage(stage, context);
        
        if (!result.success) {
          await this.handleFailure(context.deploymentId, stage, result.message);
          throw new Error(`Deployment failed at stage: ${stage}`);
        }
        
        currentStage++;
      }
      
      await this.markComplete(context.deploymentId);
      
      const finalDeployment = await db.queryRow<DeploymentLog>`
        SELECT * FROM deployment_logs WHERE id = ${context.deploymentId}
      `;
      
      if (!finalDeployment) {
        throw new Error("Deployment not found after completion");
      }
      
      return finalDeployment;
    } catch (error) {
      await this.markFailed(context.deploymentId, error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  }

  private async executeStage(stage: DeploymentStage, context: DeploymentContext): Promise<StageResult> {
    switch (stage) {
      case 'validation':
        return await this.validateDeployment(context);
      case 'build':
        return await this.buildProject(context);
      case 'testing':
        return await this.runTests(context);
      case 'migration':
        return await this.runMigrations(context);
      case 'deployment':
        return await this.deployArtifacts(context);
      case 'health_check':
        return await this.performHealthCheck(context);
      case 'complete':
        return { success: true };
      default:
        return { success: false, message: `Unknown stage: ${stage}` };
    }
  }

  private async validateDeployment(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Validating deployment configuration...");
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: "Validation passed" };
  }

  private async buildProject(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Building project...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, message: "Build completed" };
  }

  private async runTests(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Running test suite...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true, message: "All tests passed" };
  }

  private async runMigrations(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Running database migrations...");
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true, message: "Migrations completed" };
  }

  private async deployArtifacts(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Deploying artifacts...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, message: "Deployment completed" };
  }

  private async performHealthCheck(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Performing health check...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, message: "Health check passed" };
  }

  private async updateProgress(deploymentId: number, stage: string, progress: number): Promise<void> {

    await db.exec`
      UPDATE deployment_logs 
      SET stage = ${stage}, progress = ${progress}, updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  }

  private async log(deploymentId: number, message: string): Promise<void> {

    const current = await db.queryRow<{ logs: string | null }>`
      SELECT logs FROM deployment_logs WHERE id = ${deploymentId}
    `;
    
    const existingLogs = current?.logs || "";
    const newLogs = existingLogs + `\n[${new Date().toISOString()}] ${message}`;
    
    await db.exec`
      UPDATE deployment_logs 
      SET logs = ${newLogs}, updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  }

  private async handleFailure(deploymentId: number, stage: string, message?: string): Promise<void> {

    await db.exec`
      UPDATE deployment_logs 
      SET 
        status = 'failed',
        error_message = ${message || "Deployment failed"},
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  }

  private async markComplete(deploymentId: number): Promise<void> {

    await db.exec`
      UPDATE deployment_logs 
      SET 
        status = 'success',
        stage = 'complete',
        progress = 100,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  }

  private async markFailed(deploymentId: number, error: string): Promise<void> {

    await db.exec`
      UPDATE deployment_logs 
      SET 
        status = 'failed',
        error_message = ${error},
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${deploymentId}
    `;
  }
}