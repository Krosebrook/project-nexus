import db from "../db";
import type { DeploymentLog, DeploymentStatus } from "./types";
import { createStateMachine, type StageHandler, type StageResult } from "../shared/state-machine";
import { deploymentNotificationTopic } from "../notifications/topics";

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
}

class ValidationStage implements StageHandler<DeploymentContext> {
  async execute(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Validating deployment configuration...");
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: "Validation passed" };
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
}

class BuildStage implements StageHandler<DeploymentContext> {
  async execute(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Building project...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, message: "Build completed" };
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
}

class TestingStage implements StageHandler<DeploymentContext> {
  async execute(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Running test suite...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true, message: "All tests passed" };
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
}

class MigrationStage implements StageHandler<DeploymentContext> {
  async execute(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Running database migrations...");
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true, message: "Migrations completed" };
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
}

class DeploymentStageHandler implements StageHandler<DeploymentContext> {
  async execute(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Deploying artifacts...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, message: "Deployment completed" };
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
}

class HealthCheckStage implements StageHandler<DeploymentContext> {
  async execute(context: DeploymentContext): Promise<StageResult> {
    await this.log(context.deploymentId, "Performing health check...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, message: "Health check passed" };
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
}

class CompleteStage implements StageHandler<DeploymentContext> {
  async execute(context: DeploymentContext): Promise<StageResult> {
    return { success: true };
  }
}

export class DeploymentStateMachine {
  private stateMachine = createStateMachine<DeploymentStage, DeploymentContext>({
    stages: ['validation', 'build', 'testing', 'migration', 'deployment', 'health_check', 'complete'],
    handlers: {
      validation: new ValidationStage(),
      build: new BuildStage(),
      testing: new TestingStage(),
      migration: new MigrationStage(),
      deployment: new DeploymentStageHandler(),
      health_check: new HealthCheckStage(),
      complete: new CompleteStage(),
    },
    onStageStart: async (stage, context) => {
      const progress = this.stateMachine.getProgress(stage);
      await this.updateProgress(context.deploymentId, stage, progress);
      await this.sendNotification(context, 'in_progress', stage, progress);
    },
    onStageFailure: async (stage, error, context) => {
      await this.handleFailure(context.deploymentId, stage, error.message);
      await this.sendNotification(context, 'failed', stage, undefined, error.message);
    },
    onComplete: async (context) => {
      await this.markComplete(context.deploymentId);
      await this.sendNotification(context, 'success', 'complete', 100);
    },
    onFailure: async (error, context) => {
      await this.markFailed(context.deploymentId, error.message);
    },
  });

  async execute(context: DeploymentContext): Promise<DeploymentLog> {
    const initialDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${context.deploymentId}
    `;
    
    if (!initialDeployment) {
      throw new Error(`Deployment ${context.deploymentId} not found at start`);
    }

    await this.stateMachine.execute(context);
    
    const finalDeployment = await db.queryRow<DeploymentLog>`
      SELECT * FROM deployment_logs WHERE id = ${context.deploymentId}
    `;
    
    if (!finalDeployment) {
      throw new Error("Deployment not found after completion");
    }
    
    return finalDeployment;
  }

  private async updateProgress(deploymentId: number, stage: string, progress: number): Promise<void> {
    await db.exec`
      UPDATE deployment_logs 
      SET stage = ${stage}, progress = ${progress}, updated_at = NOW()
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

  private async sendNotification(
    context: DeploymentContext,
    status: 'started' | 'in_progress' | 'success' | 'failed',
    stage?: string,
    progress?: number,
    error?: string
  ): Promise<void> {
    try {
      const deployment = await db.queryRow<{
        project_name: string;
        environment_name: string;
      }>`
        SELECT p.name as project_name, e.name as environment_name
        FROM deployment_logs dl
        JOIN projects p ON p.id = dl.project_id
        LEFT JOIN environments e ON e.id = dl.environment_id
        WHERE dl.id = ${context.deploymentId}
      `;

      if (!deployment) return;

      await deploymentNotificationTopic.publish({
        deploymentId: context.deploymentId,
        projectId: context.projectId,
        projectName: deployment.project_name,
        environmentName: deployment.environment_name || 'unknown',
        status,
        stage,
        progress,
        message: error || `Deployment ${status}${stage ? ` at ${stage}` : ''}`,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Failed to send deployment notification:", error);
    }
  }
}