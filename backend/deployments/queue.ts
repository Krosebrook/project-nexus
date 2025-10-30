import { api } from "encore.dev/api";
import db from "../db";

export type DeploymentPriority = 'low' | 'normal' | 'high' | 'critical';
export type QueueStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface QueuedDeployment {
  id: number;
  deploymentId: number;
  projectId: number;
  projectName: string;
  environment: string;
  priority: DeploymentPriority;
  scheduledFor: Date;
  status: QueueStatus;
  queuePosition: number;
  estimatedStartTime?: Date;
  createdAt: Date;
}

export interface ScheduleDeploymentRequest {
  projectId: number;
  environment: string;
  scheduledFor: Date;
  priority?: DeploymentPriority;
  config?: Record<string, any>;
}

export interface ScheduleDeploymentResponse {
  queueId: number;
  deploymentId: number;
  queuePosition: number;
  estimatedStartTime: Date;
}

export const scheduleDeployment = api(
  { method: "POST", path: "/deployments/schedule", expose: true },
  async (req: ScheduleDeploymentRequest): Promise<ScheduleDeploymentResponse> => {
    const priority = req.priority || 'normal';

    const deployment = await db.queryRow<{ id: bigint }>`
      INSERT INTO deployment_logs (
        project_id,
        environment,
        status,
        stage,
        progress
      ) VALUES (
        ${req.projectId},
        ${req.environment},
        'pending',
        'queued',
        0
      )
      RETURNING id
    `;

    const deploymentId = Number(deployment!.id);

    const queueEntry = await db.queryRow<{ id: bigint }>`
      INSERT INTO deployment_queue (
        deployment_id,
        project_id,
        environment,
        priority,
        scheduled_for,
        status,
        config
      ) VALUES (
        ${deploymentId},
        ${req.projectId},
        ${req.environment},
        ${priority},
        ${req.scheduledFor},
        'queued',
        ${JSON.stringify(req.config || {})}
      )
      RETURNING id
    `;

    const queueId = Number(queueEntry!.id);

    const position = await getQueuePosition(queueId);
    const estimatedStartTime = await calculateEstimatedStartTime(position, req.scheduledFor);

    return {
      queueId,
      deploymentId,
      queuePosition: position,
      estimatedStartTime
    };
  }
);

export interface ListQueueRequest {
  projectId?: number;
  status?: QueueStatus;
  limit?: number;
}

export interface ListQueueResponse {
  queue: QueuedDeployment[];
  totalCount: number;
}

export const listQueue = api(
  { method: "GET", path: "/deployments/queue", expose: true },
  async (req: ListQueueRequest): Promise<ListQueueResponse> => {
    const limit = req.limit || 50;

    let queue;
    let totalCount;

    if (req.projectId && req.status) {
      queue = await db.queryAll<{
        id: number;
        deployment_id: number;
        project_id: number;
        project_name: string;
        environment: string;
        priority: DeploymentPriority;
        scheduled_for: Date;
        status: QueueStatus;
        created_at: Date;
      }>`
        SELECT 
          dq.id,
          dq.deployment_id,
          dq.project_id,
          p.name as project_name,
          dq.environment,
          dq.priority,
          dq.scheduled_for,
          dq.status,
          dq.created_at
        FROM deployment_queue dq
        JOIN projects p ON p.id = dq.project_id
        WHERE dq.project_id = ${req.projectId} AND dq.status = ${req.status}
        ORDER BY 
          CASE dq.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          dq.scheduled_for ASC
        LIMIT ${limit}
      `;

      totalCount = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM deployment_queue dq
        WHERE dq.project_id = ${req.projectId} AND dq.status = ${req.status}
      `;
    } else if (req.projectId) {
      queue = await db.queryAll<{
        id: number;
        deployment_id: number;
        project_id: number;
        project_name: string;
        environment: string;
        priority: DeploymentPriority;
        scheduled_for: Date;
        status: QueueStatus;
        created_at: Date;
      }>`
        SELECT 
          dq.id,
          dq.deployment_id,
          dq.project_id,
          p.name as project_name,
          dq.environment,
          dq.priority,
          dq.scheduled_for,
          dq.status,
          dq.created_at
        FROM deployment_queue dq
        JOIN projects p ON p.id = dq.project_id
        WHERE dq.project_id = ${req.projectId}
        ORDER BY 
          CASE dq.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          dq.scheduled_for ASC
        LIMIT ${limit}
      `;

      totalCount = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM deployment_queue dq
        WHERE dq.project_id = ${req.projectId}
      `;
    } else if (req.status) {
      queue = await db.queryAll<{
        id: number;
        deployment_id: number;
        project_id: number;
        project_name: string;
        environment: string;
        priority: DeploymentPriority;
        scheduled_for: Date;
        status: QueueStatus;
        created_at: Date;
      }>`
        SELECT 
          dq.id,
          dq.deployment_id,
          dq.project_id,
          p.name as project_name,
          dq.environment,
          dq.priority,
          dq.scheduled_for,
          dq.status,
          dq.created_at
        FROM deployment_queue dq
        JOIN projects p ON p.id = dq.project_id
        WHERE dq.status = ${req.status}
        ORDER BY 
          CASE dq.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          dq.scheduled_for ASC
        LIMIT ${limit}
      `;

      totalCount = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM deployment_queue dq
        WHERE dq.status = ${req.status}
      `;
    } else {
      queue = await db.queryAll<{
        id: number;
        deployment_id: number;
        project_id: number;
        project_name: string;
        environment: string;
        priority: DeploymentPriority;
        scheduled_for: Date;
        status: QueueStatus;
        created_at: Date;
      }>`
        SELECT 
          dq.id,
          dq.deployment_id,
          dq.project_id,
          p.name as project_name,
          dq.environment,
          dq.priority,
          dq.scheduled_for,
          dq.status,
          dq.created_at
        FROM deployment_queue dq
        JOIN projects p ON p.id = dq.project_id
        ORDER BY 
          CASE dq.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          dq.scheduled_for ASC
        LIMIT ${limit}
      `;

      totalCount = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM deployment_queue dq
      `;
    }

    const queueWithPositions = await Promise.all(
      queue.map(async (item: any, index: number) => {
        const position = index + 1;
        const estimatedStartTime = await calculateEstimatedStartTime(position, item.scheduled_for);

        return {
          id: item.id,
          deploymentId: item.deployment_id,
          projectId: item.project_id,
          projectName: item.project_name,
          environment: item.environment,
          priority: item.priority,
          scheduledFor: item.scheduled_for,
          status: item.status,
          queuePosition: position,
          estimatedStartTime,
          createdAt: item.created_at
        };
      })
    );

    return {
      queue: queueWithPositions,
      totalCount: totalCount?.count || 0
    };
  }
);

export interface CancelQueuedDeploymentRequest {
  queueId: number;
}

export interface CancelQueuedDeploymentResponse {
  success: boolean;
}

export const cancelQueued = api(
  { method: "POST", path: "/deployments/queue/:queueId/cancel", expose: true },
  async (req: CancelQueuedDeploymentRequest): Promise<CancelQueuedDeploymentResponse> => {
    const queueEntry = await db.queryRow<{ deployment_id: number; status: string }>`
      SELECT deployment_id, status
      FROM deployment_queue
      WHERE id = ${req.queueId}
    `;

    if (!queueEntry) {
      throw new Error("Queue entry not found");
    }

    if (queueEntry.status === 'running') {
      throw new Error("Cannot cancel deployment that is already running");
    }

    await db.exec`
      UPDATE deployment_queue
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id = ${req.queueId}
    `;

    await db.exec`
      UPDATE deployment_logs
      SET status = 'cancelled',
          stage = 'cancelled'
      WHERE id = ${queueEntry.deployment_id}
    `;

    return { success: true };
  }
);

async function getQueuePosition(queueId: number): Promise<number> {
  const result = await db.queryRow<{ position: number }>`
    WITH ranked_queue AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          ORDER BY 
            CASE priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'normal' THEN 3
              WHEN 'low' THEN 4
            END,
            scheduled_for ASC
        ) as position
      FROM deployment_queue
      WHERE status = 'queued'
    )
    SELECT position
    FROM ranked_queue
    WHERE id = ${queueId}
  `;

  return result?.position || 0;
}

async function calculateEstimatedStartTime(position: number, scheduledFor: Date): Promise<Date> {
  const avgDeploymentDuration = 10 * 60 * 1000;
  
  const estimatedDelay = (position - 1) * avgDeploymentDuration;
  
  const estimatedStart = new Date(scheduledFor.getTime() + estimatedDelay);
  
  const now = new Date();
  if (estimatedStart < now) {
    return now;
  }
  
  return estimatedStart;
}

export async function processQueue(): Promise<void> {
  const concurrencyLimits = await db.queryAll<{
    project_id: number;
    max_concurrent: number;
    current_running: number;
  }>`
    SELECT 
      p.id as project_id,
      COALESCE(p.metrics->>'max_concurrent_deployments', '2')::integer as max_concurrent,
      COUNT(dq.id) FILTER (WHERE dq.status = 'running') as current_running
    FROM projects p
    LEFT JOIN deployment_queue dq ON dq.project_id = p.id AND dq.status = 'running'
    GROUP BY p.id
  `;

  const limits = new Map(
    concurrencyLimits.map((l: any) => [l.project_id, { max: l.max_concurrent, current: l.current_running }])
  );

  const readyDeployments = await db.queryAll<{
    id: number;
    deployment_id: number;
    project_id: number;
    scheduled_for: Date;
  }>`
    SELECT id, deployment_id, project_id, scheduled_for
    FROM deployment_queue
    WHERE status = 'queued'
      AND scheduled_for <= NOW()
    ORDER BY 
      CASE priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      scheduled_for ASC
  `;

  for (const deployment of readyDeployments) {
    const limit = limits.get(deployment.project_id) || { max: 2, current: 0 };
    
    if (limit.current >= limit.max) {
      continue;
    }

    await db.exec`
      UPDATE deployment_queue
      SET status = 'running',
          started_at = NOW(),
          updated_at = NOW()
      WHERE id = ${deployment.id}
    `;

    await db.exec`
      UPDATE deployment_logs
      SET status = 'running',
          stage = 'starting'
      WHERE id = ${deployment.deployment_id}
    `;

    limit.current++;
    limits.set(deployment.project_id, limit);
  }
}
