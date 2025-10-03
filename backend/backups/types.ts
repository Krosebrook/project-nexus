export interface DatabaseBackup {
  id: number;
  backup_name: string;
  description?: string;
  backup_type: "manual" | "automatic" | "scheduled";
  file_size?: number;
  backup_data: Record<string, any>;
  created_by?: string;
  created_at: Date;
  restored_at?: Date;
}

export interface CreateBackupRequest {
  backup_name: string;
  description?: string;
  backup_type?: "manual" | "automatic" | "scheduled";
  created_by?: string;
  include_tables?: string[];
}

export interface RestoreBackupRequest {
  backup_id: number;
  restored_by?: string;
  confirm: boolean;
}

export interface BackupListResponse {
  backups: DatabaseBackup[];
  total: number;
}

export interface RestoreStatus {
  id: number;
  backup_id: number;
  restored_by?: string;
  restore_status: "pending" | "in_progress" | "completed" | "failed";
  restore_errors?: string;
  rows_affected?: Record<string, number>;
  created_at: Date;
}