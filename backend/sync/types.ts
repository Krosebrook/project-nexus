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
  event_id: string;
  entity: string;
  local_version: number;
  remote_version: number;
  local_data: any;
  remote_data: any;
  resolution: 'pending' | 'local-wins' | 'remote-wins' | 'merged';
  created_at: string;
}

export interface PushRequest {
  events: SyncEvent[];
}

export interface PushResponse {
  accepted: number;
  rejected: number;
}

export interface PullRequest {
  client_id: string;
  since_version: number;
}

export interface PullResponse {
  events: SyncEvent[];
  conflicts: SyncConflict[];
}
