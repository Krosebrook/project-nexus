import Dexie, { Table } from 'dexie';

export interface Deployment {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  project_id: string;
  environment: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  version: number;
  client_id: string;
  synced: boolean;
  last_synced_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  version: number;
  synced: boolean;
}

export interface Artifact {
  id: string;
  deployment_id: string;
  version: string;
  git_commit_sha: string;
  build_timestamp: string;
  build_size_bytes: number;
  env_variables: Record<string, string>;
  docker_image_tag?: string;
  created_at: string;
  synced: boolean;
}

export interface QueueItem {
  id: string;
  deployment_id: string;
  scheduled_at: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'queued' | 'running' | 'completed' | 'cancelled';
  created_at: string;
  synced: boolean;
}

export interface SyncEvent {
  id: string;
  entity: 'deployment' | 'project' | 'artifact' | 'queue_item';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
  client_id: string;
  version: number;
  synced: boolean;
}

export interface SyncConflict {
  id?: number;
  event_id: string;
  entity: string;
  local_version: number;
  remote_version: number;
  local_data: any;
  remote_data: any;
  resolution: 'pending' | 'local-wins' | 'remote-wins' | 'merged';
  resolved_at?: string;
  created_at: string;
}

export class DeploymentDB extends Dexie {
  deployments!: Table<Deployment, string>;
  projects!: Table<Project, string>;
  artifacts!: Table<Artifact, string>;
  queue_items!: Table<QueueItem, string>;
  sync_events!: Table<SyncEvent, string>;
  sync_conflicts!: Table<SyncConflict, number>;

  constructor() {
    super('DeploymentPlatform');
    
    this.version(1).stores({
      deployments: 'id, status, project_id, created_at, synced',
      projects: 'id, created_at, synced',
      artifacts: 'id, deployment_id, synced',
      queue_items: 'id, scheduled_at, status, synced',
      sync_events: 'id, timestamp, entity, synced',
      sync_conflicts: '++id, event_id, created_at, resolution',
    });

    this.version(2).stores({
      deployments: 'id, [status+created_at], project_id, created_at, synced',
      sync_events: 'id, [synced+timestamp], timestamp, entity, synced',
    });

    this.deployments.hook('creating', (primKey, obj) => {
      this.recordChange('deployment', 'INSERT', obj);
    });

    this.deployments.hook('updating', (modifications, primKey, obj) => {
      const merged = { ...obj, ...modifications };
      this.recordChange('deployment', 'UPDATE', merged);
    });

    this.deployments.hook('deleting', (primKey, obj) => {
      this.recordChange('deployment', 'DELETE', obj);
    });

    this.projects.hook('creating', (primKey, obj) => {
      this.recordChange('project', 'INSERT', obj);
    });

    this.projects.hook('updating', (modifications, primKey, obj) => {
      const merged = { ...obj, ...modifications };
      this.recordChange('project', 'UPDATE', merged);
    });

    this.projects.hook('deleting', (primKey, obj) => {
      this.recordChange('project', 'DELETE', obj);
    });

    this.artifacts.hook('creating', (primKey, obj) => {
      this.recordChange('artifact', 'INSERT', obj);
    });

    this.artifacts.hook('updating', (modifications, primKey, obj) => {
      const merged = { ...obj, ...modifications };
      this.recordChange('artifact', 'UPDATE', merged);
    });

    this.artifacts.hook('deleting', (primKey, obj) => {
      this.recordChange('artifact', 'DELETE', obj);
    });

    this.queue_items.hook('creating', (primKey, obj) => {
      this.recordChange('queue_item', 'INSERT', obj);
    });

    this.queue_items.hook('updating', (modifications, primKey, obj) => {
      const merged = { ...obj, ...modifications };
      this.recordChange('queue_item', 'UPDATE', merged);
    });

    this.queue_items.hook('deleting', (primKey, obj) => {
      this.recordChange('queue_item', 'DELETE', obj);
    });
  }

  private async recordChange(
    entity: 'deployment' | 'project' | 'artifact' | 'queue_item',
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    data: any
  ) {
    const clientId = this.getClientId();
    const version = await this.getNextVersion();

    const event: SyncEvent = {
      id: `${clientId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entity,
      operation,
      data,
      timestamp: Date.now(),
      client_id: clientId,
      version,
      synced: false,
    };

    await this.sync_events.add(event);
  }

  getClientId(): string {
    let clientId = localStorage.getItem('sync_client_id');
    if (!clientId) {
      clientId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('sync_client_id', clientId);
    }
    return clientId;
  }

  private async getNextVersion(): Promise<number> {
    const lastEvent = await this.sync_events
      .orderBy('version')
      .reverse()
      .first();
    
    return (lastEvent?.version ?? 0) + 1;
  }

  async getStorageEstimate(): Promise<{ usage: number; quota: number; percentage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
        percentage: ((estimate.usage ?? 0) / (estimate.quota ?? 1)) * 100,
      };
    }
    return { usage: 0, quota: 0, percentage: 0 };
  }

  async pruneOldData(keepDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    const cutoffISO = cutoffDate.toISOString();

    await this.sync_events
      .where('timestamp')
      .below(cutoffDate.getTime())
      .and(event => event.synced)
      .delete();

    const totalDeployments = await this.deployments.count();
    if (totalDeployments > 200) {
      const toDelete = totalDeployments - 200;
      const oldestDeployments = await this.deployments
        .orderBy('created_at')
        .limit(toDelete)
        .toArray();
      
      await this.deployments.bulkDelete(oldestDeployments.map(d => d.id));
    }

    const conflictCutoff = new Date();
    conflictCutoff.setDate(conflictCutoff.getDate() - 30);
    
    await this.sync_conflicts
      .where('created_at')
      .below(conflictCutoff.toISOString())
      .and(conflict => conflict.resolution !== 'pending')
      .delete();
  }
}

export const db = new DeploymentDB();
