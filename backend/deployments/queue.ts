import { api } from "encore.dev/api";
import db from "../db";

export interface QueuedDeployment {
  id: number;
  project_id: number;
  environment_id: number;
  deployment_id: number | null;
  queue_position: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  scheduled_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  requested_by: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface EnqueueDeploymentRequest {
  project_id: number;
  environment_id: number;
  priority?: number;
  scheduled_at?: Date;
  requested_by?: string;
  metadata?: Record<string, any>;
}

export const enqueueDeployment = api(
  { method: "POST", path: "/deployments/queue", expose: true },
  async (req: EnqueueDeploymentRequest): Promise<QueuedDeployment> => {
    const maxPosition = await db.queryRow<{ max_position: number | null }>`
      SELECT MAX(queue_position) as max_position
      FROM deployment_queue
      WHERE environment_id = ${req.environment_id}
        AND status = 'queued'
    `;

    const nextPosition = (maxPosition?.max_position || 0) + 1;

    const queued = await db.queryRow<QueuedDeployment>`
      INSERT INTO deployment_queue (
        project_id,
        environment_id,
        queue_position,
        priority,
        scheduled_at,
        requested_by,
        metadata,
        status
      ) VALUES (
        ${req.project_id},
        ${req.environment_id},
        ${nextPosition},
        ${req.priority || 0},
        ${req.scheduled_at || null},
        ${req.requested_by || null},
        ${JSON.stringify(req.metadata || {})},
        'queued'
      )
      RETURNING *
    `;

    if (!queued) {
      throw new Error("Failed to enqueue deployment");
    }

    return queued;
  }
);

export interface ListQueueRequest {
  environment_id?: number;
  project_id?: number;
  status?: string;
}

export interface ListQueueResponse {
  queue: QueuedDeployment[];
}

export const listQueue = api(
  { method: "GET", path: "/deployments/queue", expose: true },
  async (req: ListQueueRequest): Promise<ListQueueResponse> => {
    let query = `
      SELECT * FROM deployment_queue
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (req.environment_id) {
      paramCount++;
      query += ` AND environment_id = $${paramCount}`;
      params.push(req.environment_id);
    }

    if (req.project_id) {
      paramCount++;
      query += ` AND project_id = $${paramCount}`;
      params.push(req.project_id);
    }

    if (req.status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(req.status);
    }

    query += ` ORDER BY priority DESC, queue_position ASC`;

    const queue = await db.query<QueuedDeployment>(query as any, ...params);

    return { queue };
  }
);

export interface UpdateQueueItemRequest {
  id: number;
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  deployment_id?: number;
  priority?: number;
}

export const updateQueueItem = api(
  { method: "PUT", path: "/deployments/queue/:id", expose: true },
  async (req: UpdateQueueItemRequest): Promise<QueuedDeployment> => {
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [req.id];
    let paramCount = 1;

    if (req.status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(req.status);

      if (req.status === 'running') {
        updates.push('started_at = NOW()');
      } else if (req.status === 'completed' || req.status === 'failed' || req.status === 'cancelled') {
        updates.push('completed_at = NOW()');
      }
    }

    if (req.deployment_id) {
      paramCount++;
      updates.push(`deployment_id = $${paramCount}`);
      params.push(req.deployment_id);
    }

    if (req.priority !== undefined) {
      paramCount++;
      updates.push(`priority = $${paramCount}`);
      params.push(req.priority);
    }

    const query = `
      UPDATE deployment_queue
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const updated = await db.queryRow<QueuedDeployment>(query as any, ...params);

    if (!updated) {
      throw new Error("Queue item not found");
    }

    return updated;
  }
);

export interface CancelQueueItemRequest {
  id: number;
}

export const cancelQueueItem = api(
  { method: "DELETE", path: "/deployments/queue/:id", expose: true },
  async ({ id }: CancelQueueItemRequest): Promise<{ success: boolean }> => {
    await db.exec`
      UPDATE deployment_queue
      SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;

    return { success: true };
  }
);

export interface DeploymentSchedule {
  id: number;
  project_id: number;
  environment_id: number;
  name: string;
  description: string | null;
  cron_expression: string | null;
  scheduled_time: Date | null;
  is_recurring: boolean;
  is_active: boolean;
  last_execution: Date | null;
  next_execution: Date | null;
  deployment_config: Record<string, any>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateScheduleRequest {
  project_id: number;
  environment_id: number;
  name: string;
  description?: string;
  cron_expression?: string;
  scheduled_time?: Date;
  is_recurring?: boolean;
  deployment_config?: Record<string, any>;
  created_by?: string;
}

export const createSchedule = api(
  { method: "POST", path: "/deployments/schedules", expose: true },
  async (req: CreateScheduleRequest): Promise<DeploymentSchedule> => {
    const schedule = await db.queryRow<DeploymentSchedule>`
      INSERT INTO deployment_schedules (
        project_id,
        environment_id,
        name,
        description,
        cron_expression,
        scheduled_time,
        is_recurring,
        deployment_config,
        created_by
      ) VALUES (
        ${req.project_id},
        ${req.environment_id},
        ${req.name},
        ${req.description || null},
        ${req.cron_expression || null},
        ${req.scheduled_time || null},
        ${req.is_recurring || false},
        ${JSON.stringify(req.deployment_config || {})},
        ${req.created_by || null}
      )
      RETURNING *
    `;

    if (!schedule) {
      throw new Error("Failed to create schedule");
    }

    return schedule;
  }
);

export interface ListSchedulesRequest {
  project_id?: number;
  is_active?: boolean;
}

export interface ListSchedulesResponse {
  schedules: DeploymentSchedule[];
}

export const listSchedules = api(
  { method: "GET", path: "/deployments/schedules", expose: true },
  async (req: ListSchedulesRequest): Promise<ListSchedulesResponse> => {
    let query = `
      SELECT * FROM deployment_schedules
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (req.project_id) {
      paramCount++;
      query += ` AND project_id = $${paramCount}`;
      params.push(req.project_id);
    }

    if (req.is_active !== undefined) {
      paramCount++;
      query += ` AND is_active = $${paramCount}`;
      params.push(req.is_active);
    }

    query += ` ORDER BY next_execution ASC NULLS LAST, created_at DESC`;

    const schedules = await db.query<DeploymentSchedule>(query as any, ...params);

    return { schedules };
  }
);