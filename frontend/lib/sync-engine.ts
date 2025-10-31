import { db, SyncEvent, SyncConflict } from '../db/schema';
import EventEmitter from 'eventemitter3';

interface SyncConfig {
  serverUrl: string;
  syncInterval: number;
  batchSize: number;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingEvents: number;
  pendingConflicts: number;
}

export class SyncEngine extends EventEmitter {
  private config: SyncConfig;
  private ws: WebSocket | null = null;
  private syncInterval: number | null = null;
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(config: SyncConfig) {
    super();
    this.config = config;
  }

  async start() {
    console.log('[SyncEngine] Starting...');

    this.connectWebSocket();

    this.syncInterval = window.setInterval(() => this.sync(), this.config.syncInterval);

    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.sync();
      }
    });

    await this.sync();
  }

  private connectWebSocket() {
    const wsUrl = this.config.serverUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const token = localStorage.getItem('auth_token');

    this.ws = new WebSocket(`${wsUrl}/sync?token=${token}`);

    this.ws.onopen = () => {
      console.log('[SyncEngine] WebSocket connected');
      this.reconnectAttempts = 0;
      this.isOnline = true;
      this.emit('online');
      
      this.sync();
    };

    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'SYNC_EVENT':
            await this.applyRemoteEvent(message.event);
            break;

          case 'CONFLICT':
            await this.handleConflict(message.conflict);
            break;

          case 'SYNC_ACK':
            await this.markEventsSynced(message.event_ids);
            break;

          default:
            console.warn('[SyncEngine] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[SyncEngine] Failed to process message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[SyncEngine] WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('[SyncEngine] WebSocket disconnected');
      this.isOnline = false;
      this.emit('offline');

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`[SyncEngine] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
        
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connectWebSocket();
        }, delay);
      } else {
        console.error('[SyncEngine] Max reconnection attempts reached');
        this.emit('reconnect-failed');
      }
    };
  }

  private handleOnline() {
    console.log('[SyncEngine] Connection restored');
    this.isOnline = true;
    this.reconnectAttempts = 0;
    this.emit('online');
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    }

    this.sync();
  }

  private handleOffline() {
    console.log('[SyncEngine] Connection lost');
    this.isOnline = false;
    this.emit('offline');
  }

  async sync(): Promise<{ pushed: number; pulled: number; conflicts: number }> {
    if (this.isSyncing) {
      console.log('[SyncEngine] Sync already in progress, skipping');
      return { pushed: 0, pulled: 0, conflicts: 0 };
    }

    if (!this.isOnline) {
      console.log('[SyncEngine] Offline, skipping sync');
      return { pushed: 0, pulled: 0, conflicts: 0 };
    }

    this.isSyncing = true;
    this.emit('sync-start');

    try {
      const pushed = await this.pushLocalChanges();

      const { pulled, conflicts } = await this.pullRemoteChanges();

      localStorage.setItem('last_sync_at', new Date().toISOString());

      this.emit('sync-complete', { pushed, pulled, conflicts });

      return { pushed, pulled, conflicts };
    } catch (error) {
      console.error('[SyncEngine] Sync failed:', error);
      this.emit('sync-error', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async pushLocalChanges(): Promise<number> {
    const events = await db.sync_events
      .where('synced')
      .equals(0)
      .limit(this.config.batchSize)
      .toArray();

    if (events.length === 0) {
      return 0;
    }

    console.log(`[SyncEngine] Pushing ${events.length} local events`);

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${this.config.serverUrl}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      throw new Error(`Push failed: ${response.statusText}`);
    }

    const { accepted, rejected } = await response.json();

    const acceptedIds = events.slice(0, accepted).map(e => e.id);
    await this.markEventsSynced(acceptedIds);

    console.log(`[SyncEngine] Pushed ${accepted} events (${rejected} rejected)`);

    return accepted;
  }

  private async pullRemoteChanges(): Promise<{ pulled: number; conflicts: number }> {
    const clientId = db.getClientId();
    const lastVersion = await this.getLastSyncVersion();

    console.log(`[SyncEngine] Pulling changes since version ${lastVersion}`);

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${this.config.serverUrl}/api/sync/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        since_version: lastVersion,
      }),
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`);
    }

    const { events, conflicts } = await response.json();

    console.log(`[SyncEngine] Received ${events.length} remote events, ${conflicts.length} conflicts`);

    for (const event of events) {
      await this.applyRemoteEvent(event);
    }

    for (const conflict of conflicts) {
      await this.handleConflict(conflict);
    }

    return { pulled: events.length, conflicts: conflicts.length };
  }

  private async applyRemoteEvent(event: SyncEvent) {
    if (event.client_id === db.getClientId()) {
      return;
    }

    console.log(`[SyncEngine] Applying remote ${event.operation} on ${event.entity}:`, event.data.id);

    const localVersion = await this.getLocalVersion(event.entity, event.data.id);

    if (localVersion !== null && localVersion >= event.version) {
      await this.logConflict({
        event_id: event.id,
        entity: event.entity,
        local_version: localVersion,
        remote_version: event.version,
        local_data: await this.getLocalData(event.entity, event.data.id),
        remote_data: event.data,
        resolution: 'pending',
        created_at: new Date().toISOString(),
      });
      return;
    }

    const table = this.getTable(event.entity);

    switch (event.operation) {
      case 'INSERT':
        await table.put({
          ...event.data,
          version: event.version,
          client_id: event.client_id,
          synced: true,
          last_synced_at: new Date().toISOString(),
        });
        break;

      case 'UPDATE':
        await table.update(event.data.id, {
          ...event.data,
          version: event.version,
          client_id: event.client_id,
          synced: true,
          last_synced_at: new Date().toISOString(),
        });
        break;

      case 'DELETE':
        await table.delete(event.data.id);
        break;
    }

    this.emit('event-applied', event);
  }

  private async getLocalVersion(entity: string, id: string): Promise<number | null> {
    const table = this.getTable(entity);
    const record = await table.get(id);
    return record ? (record as any).version : null;
  }

  private async getLocalData(entity: string, id: string): Promise<any> {
    const table = this.getTable(entity);
    return table.get(id);
  }

  private getTable(entity: string) {
    switch (entity) {
      case 'deployment':
        return db.deployments;
      case 'project':
        return db.projects;
      case 'artifact':
        return db.artifacts;
      case 'queue_item':
        return db.queue_items;
      default:
        throw new Error(`Unknown entity: ${entity}`);
    }
  }

  private async handleConflict(conflict: Omit<SyncConflict, 'id'>) {
    await db.sync_conflicts.add(conflict as SyncConflict);
    this.emit('conflict', conflict);
  }

  private async logConflict(conflict: Omit<SyncConflict, 'id'>) {
    await db.sync_conflicts.add(conflict as SyncConflict);
    this.emit('conflict', conflict);
  }

  private async markEventsSynced(eventIds: string[]) {
    if (eventIds.length === 0) return;

    await db.sync_events.bulkUpdate(
      eventIds.map(id => ({ key: id, changes: { synced: true } }))
    );
  }

  private async getLastSyncVersion(): Promise<number> {
    const lastEvent = await db.sync_events
      .orderBy('version')
      .reverse()
      .first();
    
    return lastEvent?.version ?? 0;
  }

  async getStatus(): Promise<SyncStatus> {
    const pendingEvents = await db.sync_events.where('synced').equals(0).count();
    const pendingConflicts = await db.sync_conflicts.where('resolution').equals('pending').count();
    const lastSyncAt = localStorage.getItem('last_sync_at');

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncAt,
      pendingEvents,
      pendingConflicts,
    };
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const syncEngine = new SyncEngine({
  serverUrl: import.meta.env.VITE_API_URL || '',
  syncInterval: 30000,
  batchSize: 50,
});
