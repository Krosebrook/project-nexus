import { api } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import db from '../db';
import { PullRequest, PullResponse, SyncEvent } from './types';

export const pull = api(
  { expose: true, method: 'POST', path: '/sync/pull', auth: true },
  async (req: PullRequest): Promise<PullResponse> => {
    const auth = getAuthData() as any;
    const userId = auth?.userID ?? 'anonymous';

    console.log(`[Sync] Pulling events since version ${req.since_version} for client ${req.client_id}`);

    const eventsResult = db.query`
      SELECT id, entity, operation, data, timestamp, client_id, version, synced
      FROM sync_events
      WHERE version > ${req.since_version}
        AND client_id != ${req.client_id}
      ORDER BY version ASC
      LIMIT 100
    `;

    const events: SyncEvent[] = [];
    for await (const row of eventsResult) {
      events.push({
        id: row.id as string,
        entity: row.entity as any,
        operation: row.operation as any,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        timestamp: row.timestamp as number,
        client_id: row.client_id as string,
        version: row.version as number,
        synced: row.synced as boolean,
      });
    }

    const conflictsResult = db.query`
      SELECT event_id, entity, local_version, remote_version, 
             local_data, remote_data, resolution, created_at
      FROM sync_conflicts
      WHERE resolution = 'pending'
      LIMIT 50
    `;

    const conflicts = [];
    for await (const row of conflictsResult) {
      conflicts.push({
        event_id: row.event_id as string,
        entity: row.entity as string,
        local_version: row.local_version as number,
        remote_version: row.remote_version as number,
        local_data: typeof row.local_data === 'string' ? JSON.parse(row.local_data) : row.local_data,
        remote_data: typeof row.remote_data === 'string' ? JSON.parse(row.remote_data) : row.remote_data,
        resolution: row.resolution as any,
        created_at: row.created_at as string,
      });
    }

    return { events, conflicts };
  }
);
