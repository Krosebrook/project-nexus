import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import db from '../db';
import { PushRequest, PushResponse, SyncEvent } from './types';

export const push = api(
  { expose: true, method: 'POST', path: '/sync/push', auth: true },
  async (req: PushRequest): Promise<PushResponse> => {
    const auth = getAuthData() as any;
    const userId = auth?.userID ?? 'anonymous';

    if (!req.events || req.events.length === 0) {
      return { accepted: 0, rejected: 0 };
    }

    console.log(`[Sync] Pushing ${req.events.length} events from client`);

    let accepted = 0;
    let rejected = 0;

    for (const event of req.events) {
      try {
        await processEvent(event, userId);
        accepted++;
      } catch (error) {
        console.error(`[Sync] Failed to process event ${event.id}:`, error);
        rejected++;
      }
    }

    return { accepted, rejected };
  }
);

async function processEvent(event: SyncEvent, userId: string) {
  const existingVersion = await getEntityVersion(event.entity, event.data.id);

  if (existingVersion && existingVersion >= event.version) {
    throw new Error(`Conflict: existing version ${existingVersion} >= incoming version ${event.version}`);
  }

  switch (event.entity) {
    case 'deployment':
      await upsertDeployment(event, userId);
      break;
    case 'project':
      await upsertProject(event, userId);
      break;
    case 'artifact':
      await upsertArtifact(event, userId);
      break;
    case 'queue_item':
      await upsertQueueItem(event, userId);
      break;
    default:
      throw new Error(`Unknown entity: ${event.entity}`);
  }

  await recordSyncEvent(event);
}

async function getEntityVersion(entity: string, id: string): Promise<number | null> {
  let result;
  
  switch (entity) {
    case 'deployment':
      result = db.query`SELECT version FROM deployments WHERE id = ${id}`;
      break;
    case 'project':
      result = db.query`SELECT version FROM projects WHERE id = ${id}`;
      break;
    case 'artifact':
      result = db.query`SELECT version FROM deployment_artifacts WHERE id = ${id}`;
      break;
    case 'queue_item':
      result = db.query`SELECT version FROM deployment_queue WHERE id = ${id}`;
      break;
    default:
      return null;
  }

  for await (const row of result) {
    return row.version as number;
  }

  return null;
}

async function upsertDeployment(event: SyncEvent, userId: string) {
  const data = event.data;

  await db.query`
    INSERT INTO deployments (
      id, name, status, project_id, environment, 
      created_at, updated_at, created_by, version
    ) VALUES (
      ${data.id}, ${data.name}, ${data.status}, ${data.project_id}, 
      ${data.environment}, ${data.created_at}, ${data.updated_at}, 
      ${userId}, ${event.version}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at,
      version = EXCLUDED.version
  `;
}

async function upsertProject(event: SyncEvent, userId: string) {
  const data = event.data;

  await db.query`
    INSERT INTO projects (
      id, name, description, created_at, updated_at, version
    ) VALUES (
      ${data.id}, ${data.name}, ${data.description}, 
      ${data.created_at}, ${data.updated_at}, ${event.version}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = EXCLUDED.updated_at,
      version = EXCLUDED.version
  `;
}

async function upsertArtifact(event: SyncEvent, userId: string) {
  const data = event.data;

  await db.query`
    INSERT INTO deployment_artifacts (
      id, deployment_id, version, git_commit_sha, 
      build_timestamp, build_size_bytes, env_variables, 
      docker_image_tag, created_at
    ) VALUES (
      ${data.id}, ${data.deployment_id}, ${data.version}, 
      ${data.git_commit_sha}, ${data.build_timestamp}, 
      ${data.build_size_bytes}, ${JSON.stringify(data.env_variables)}, 
      ${data.docker_image_tag}, ${data.created_at}
    )
    ON CONFLICT (id) DO UPDATE SET
      git_commit_sha = EXCLUDED.git_commit_sha,
      build_timestamp = EXCLUDED.build_timestamp,
      build_size_bytes = EXCLUDED.build_size_bytes
  `;
}

async function upsertQueueItem(event: SyncEvent, userId: string) {
  const data = event.data;

  await db.query`
    INSERT INTO deployment_queue (
      id, deployment_id, scheduled_at, priority, 
      status, created_at
    ) VALUES (
      ${data.id}, ${data.deployment_id}, ${data.scheduled_at}, 
      ${data.priority}, ${data.status}, ${data.created_at}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      scheduled_at = EXCLUDED.scheduled_at
  `;
}

async function recordSyncEvent(event: SyncEvent) {
  await db.query`
    INSERT INTO sync_events (
      id, entity, operation, data, timestamp, 
      client_id, version, synced
    ) VALUES (
      ${event.id}, ${event.entity}, ${event.operation}, 
      ${JSON.stringify(event.data)}, ${event.timestamp}, 
      ${event.client_id}, ${event.version}, true
    )
  `;
}
