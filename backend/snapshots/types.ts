export interface ContextSnapshot {
  id: number;
  project_id: number;
  notes: string;
  urls: string[];
  created_at: Date;
  updated_at: Date;
}

export interface SaveSnapshotRequest {
  project_id: number;
  notes: string;
  urls: string[];
}

export interface DeleteSnapshotRequest {
  id: number;
}