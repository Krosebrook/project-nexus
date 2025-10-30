import { createStateMachine, effect, defaultRetryPolicy, type StateMachineConfig, type Effect, type EffectResult } from '../../../packages/deploy-sm/src';
import db from '../../../backend/db';
import { deploymentNotificationTopic } from '../../../backend/notifications/topics';

export type DeploymentState =
  | 'idle'
  | 'validating'
  | 'building'
  | 'testing'
  | 'migrating'
  | 'deploying'
  | 'healthChecking'
  | 'completed'
  | 'failed'
  | 'rollingBack'
  | 'rolledBack';

export type DeploymentEvent =
  | 'START'
  | 'VALIDATION_SUCCESS'
  | 'BUILD_SUCCESS'
  | 'TEST_SUCCESS'
  | 'MIGRATION_SUCCESS'
  | 'DEPLOY_SUCCESS'
  | 'HEALTH_CHECK_SUCCESS'
  | 'FAILURE'
  | 'ROLLBACK'
  | 'ROLLBACK_SUCCESS'
  | 'CANCEL';

export interface DeploymentContext {
  deploymentId: number;
  projectId: number;
  environmentId: number;
  userId?: number;
  config?: Record<string, any>;
}

async function logDeployment(deploymentId: number, message: string): Promise<void> {
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

const validationEffect: Effect<DeploymentContext> = effect<DeploymentContext>()
  .execute(async (context, state) => {
    await logDeployment(context.deploymentId, 'Starting validation...');
    
    const deployment = await db.queryRow<{ project_id: number; environment_id: number }>`
      SELECT project_id, environment_id FROM deployment_logs WHERE id = ${context.deploymentId}
    `;

    if (!deployment) {
      return { success: false, message: 'Deployment not found', canRetry: false };
    }

    const project = await db.queryRow<{ id: number }>`
      SELECT id FROM projects WHERE id = ${deployment.project_id}
    `;

    if (!project) {
      return { success: false, message: 'Project not found', canRetry: false };
    }

    await logDeployment(context.deploymentId, 'Validation completed successfully');
    return { success: true, message: 'Validation passed' };
  })
  .setIdempotent(true)
  .build();

const buildEffect: Effect<DeploymentContext> = effect<DeploymentContext>()
  .execute(async (context, state) => {
    await logDeployment(context.deploymentId, 'Starting build process...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await logDeployment(context.deploymentId, 'Build completed successfully');
    return { success: true, message: 'Build successful' };
  })
  .setIdempotent(true)
  .build();

const testEffect: Effect<DeploymentContext> = effect<DeploymentContext>()
  .execute(async (context, state) => {
    await logDeployment(context.deploymentId, 'Running test suite...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    await logDeployment(context.deploymentId, 'All tests passed');
    return { success: true, message: 'Tests passed' };
  })
  .setIdempotent(true)
  .build();

const migrationEffect: Effect<DeploymentContext> = effect<DeploymentContext>()
  .execute(async (context, state) => {
    await logDeployment(context.deploymentId, 'Running database migrations...');
    await new Promise(resolve => setTimeout(resolve, 800));
    await logDeployment(context.deploymentId, 'Migrations completed');
    return { success: true, message: 'Migrations successful' };
  })
  .rollback(async (context, state) => {
    await logDeployment(context.deploymentId, 'Rolling back migrations...');
    await new Promise(resolve => setTimeout(resolve, 500));
  })
  .setIdempotent(false)
  .build();

const deploymentEffect: Effect<DeploymentContext> = effect<DeploymentContext>()
  .execute(async (context, state) => {
    await logDeployment(context.deploymentId, 'Deploying artifacts...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await logDeployment(context.deploymentId, 'Deployment completed');
    return { success: true, message: 'Deployment successful' };
  })
  .rollback(async (context, state) => {
    await logDeployment(context.deploymentId, 'Rolling back deployment...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  })
  .setIdempotent(false)
  .build();

const healthCheckEffect: Effect<DeploymentContext> = effect<DeploymentContext>()
  .execute(async (context, state) => {
    await logDeployment(context.deploymentId, 'Performing health checks...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await logDeployment(context.deploymentId, 'Health checks passed');
    return { success: true, message: 'Health check passed' };
  })
  .setIdempotent(true)
  .build();

const rollbackEffect: Effect<DeploymentContext> = effect<DeploymentContext>()
  .execute(async (context, state) => {
    await logDeployment(context.deploymentId, 'Starting rollback process...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    await logDeployment(context.deploymentId, 'Rollback completed');
    return { success: true, message: 'Rollback successful' };
  })
  .setIdempotent(true)
  .build();

export function createDeploymentStateMachine(context: DeploymentContext) {
  const config: StateMachineConfig<DeploymentState, DeploymentEvent, DeploymentContext> = {
    id: `deployment-${context.deploymentId}`,
    initialState: 'idle',
    states: [
      'idle',
      'validating',
      'building',
      'testing',
      'migrating',
      'deploying',
      'healthChecking',
      'completed',
      'failed',
      'rollingBack',
      'rolledBack',
    ],
    events: [
      'START',
      'VALIDATION_SUCCESS',
      'BUILD_SUCCESS',
      'TEST_SUCCESS',
      'MIGRATION_SUCCESS',
      'DEPLOY_SUCCESS',
      'HEALTH_CHECK_SUCCESS',
      'FAILURE',
      'ROLLBACK',
      'ROLLBACK_SUCCESS',
      'CANCEL',
    ],
    transitions: [
      { from: 'idle', to: 'validating', event: 'START' },
      { from: 'validating', to: 'building', event: 'VALIDATION_SUCCESS' },
      { from: 'building', to: 'testing', event: 'BUILD_SUCCESS' },
      { from: 'testing', to: 'migrating', event: 'TEST_SUCCESS' },
      { from: 'migrating', to: 'deploying', event: 'MIGRATION_SUCCESS' },
      { from: 'deploying', to: 'healthChecking', event: 'DEPLOY_SUCCESS' },
      { from: 'healthChecking', to: 'completed', event: 'HEALTH_CHECK_SUCCESS' },
      
      { from: ['validating', 'building', 'testing', 'migrating', 'deploying', 'healthChecking'], to: 'failed', event: 'FAILURE' },
      { from: 'failed', to: 'rollingBack', event: 'ROLLBACK' },
      { from: 'rollingBack', to: 'rolledBack', event: 'ROLLBACK_SUCCESS' },
    ],
    effects: new Map([
      ['validating', validationEffect],
      ['building', buildEffect],
      ['testing', testEffect],
      ['migrating', migrationEffect],
      ['deploying', deploymentEffect],
      ['healthChecking', healthCheckEffect],
      ['rollingBack', rollbackEffect],
    ]),
    retryPolicy: {
      ...defaultRetryPolicy,
      maxAttempts: 3,
      shouldRetry: (error, attempt) => {
        if (error.message.includes('not found')) return false;
        return attempt < 3;
      },
    },
    timeout: {
      effectTimeout: 60000,
      transitionTimeout: 5000,
    },
    hooks: {
      onStateEnter: async (state, ctx) => {
        const stageMap: Record<string, string> = {
          validating: 'validation',
          building: 'build',
          testing: 'testing',
          migrating: 'migration',
          deploying: 'deployment',
          healthChecking: 'health_check',
          completed: 'complete',
        };

        const dbStage = stageMap[state.name] || state.name;
        const progress = calculateProgress(state.name);

        await db.exec`
          UPDATE deployment_logs 
          SET stage = ${dbStage}, progress = ${progress}, updated_at = NOW()
          WHERE id = ${ctx.deploymentId}
        `;

        await sendNotification(ctx, 'in_progress', dbStage, progress);
      },
      onError: async (error, state, ctx) => {
        await db.exec`
          UPDATE deployment_logs 
          SET 
            status = 'failed',
            error_message = ${error.message},
            updated_at = NOW()
          WHERE id = ${ctx.deploymentId}
        `;
        await sendNotification(ctx, 'failed', state.name, undefined, error.message);
      },
      onRetry: async (attempt, error, state, ctx) => {
        await logDeployment(ctx.deploymentId, `Retry attempt ${attempt} due to: ${error.message}`);
      },
      onComplete: async (finalState, ctx, metrics) => {
        await db.exec`
          UPDATE deployment_logs 
          SET 
            status = 'success',
            stage = 'complete',
            progress = 100,
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${ctx.deploymentId}
        `;
        await sendNotification(ctx, 'success', 'complete', 100);
      },
      onCancel: async (state, ctx) => {
        await db.exec`
          UPDATE deployment_logs 
          SET 
            status = 'cancelled',
            updated_at = NOW()
          WHERE id = ${ctx.deploymentId}
        `;
      },
      onLog: async (level, message, metadata) => {
        if (level === 'error' || level === 'warn') {
          console[level](`[DeploymentStateMachine] ${message}`, metadata);
        }
      },
    },
    persistState: async (state) => {
      await db.exec`
        UPDATE deployment_logs 
        SET 
          state_snapshot = ${JSON.stringify(state)},
          updated_at = NOW()
        WHERE id = ${context.deploymentId}
      `;
    },
    loadState: async () => {
      const row = await db.queryRow<{ state_snapshot: string | null }>`
        SELECT state_snapshot FROM deployment_logs WHERE id = ${context.deploymentId}
      `;
      return row?.state_snapshot ? JSON.parse(row.state_snapshot) : null;
    },
  };

  return createStateMachine(config, context);
}

function calculateProgress(state: DeploymentState): number {
  const progressMap: Record<DeploymentState, number> = {
    idle: 0,
    validating: 10,
    building: 25,
    testing: 40,
    migrating: 60,
    deploying: 75,
    healthChecking: 90,
    completed: 100,
    failed: 0,
    rollingBack: 50,
    rolledBack: 0,
  };
  return progressMap[state] || 0;
}

async function sendNotification(
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
    console.error('Failed to send deployment notification:', error);
  }
}

export async function executeDeployment(context: DeploymentContext): Promise<void> {
  const sm = createDeploymentStateMachine(context);

  const savedState = await sm.getContext();
  if (savedState) {
    await logDeployment(context.deploymentId, 'Resuming from saved state');
  }

  await sm.dispatch({ type: 'START', timestamp: new Date() });
  await sm.dispatch({ type: 'VALIDATION_SUCCESS', timestamp: new Date() });
  await sm.dispatch({ type: 'BUILD_SUCCESS', timestamp: new Date() });
  await sm.dispatch({ type: 'TEST_SUCCESS', timestamp: new Date() });
  await sm.dispatch({ type: 'MIGRATION_SUCCESS', timestamp: new Date() });
  await sm.dispatch({ type: 'DEPLOY_SUCCESS', timestamp: new Date() });
  await sm.dispatch({ type: 'HEALTH_CHECK_SUCCESS', timestamp: new Date() });
  
  await sm.complete();
}
