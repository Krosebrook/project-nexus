export interface DeploymentLog {
  id: number;
  project_id: number;
  environment: string;
  status: string;
  stage?: string;
  progress: number;
  logs?: string;
  created_at: Date;
}

export interface DeployRequest {
  project_id: number;
  environment: string;
  checklist: {
    tests_passed: boolean;
    breaking_changes_documented: boolean;
    migrations_ready: boolean;
  };
}

export interface DeploymentProgress {
  id: number;
  status: string;
  stage: string;
  progress: number;
  logs: string;
}

export interface LogsRequest {
  project_id: number;
  time_range?: string;
  level?: string;
}

export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
}