export type DeploymentStatus = 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
export type EnvironmentType = 'development' | 'staging' | 'production';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface Environment {
  id: number;
  project_id: number;
  name: string;
  type: EnvironmentType;
  url?: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DeploymentLog {
  id: number;
  project_id: number;
  environment_id: number;
  status: DeploymentStatus;
  stage?: string;
  progress: number;
  logs?: string;
  error_message?: string;
  rollback_from_deployment_id?: number;
  metadata?: Record<string, any>;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DeployRequest {
  project_id: number;
  environment_id: number;
  checklist: {
    tests_passed: boolean;
    breaking_changes_documented: boolean;
    migrations_ready: boolean;
  };
}

export interface DeploymentProgress {
  id: number;
  status: DeploymentStatus;
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

export interface RollbackRequest {
  deployment_id: number;
  reason?: string;
}

export interface DeploymentComparison {
  id: number;
  project_id: number;
  deployment_a_id: number;
  deployment_b_id: number;
  diff_summary?: Record<string, any>;
  created_at: Date;
}

export interface TestCoverage {
  id: number;
  project_id: number;
  deployment_id?: number;
  total_lines: number;
  covered_lines: number;
  coverage_percentage: number;
  file_coverage?: Record<string, any>;
  created_at: Date;
}

export interface Incident {
  id: number;
  project_id: number;
  deployment_id?: number;
  severity: IncidentSeverity;
  title: string;
  description?: string;
  status: IncidentStatus;
  resolved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectDependency {
  id: number;
  project_id: number;
  depends_on_project_id: number;
  dependency_type: 'direct' | 'transitive' | 'dev';
  version_constraint?: string;
  created_at: Date;
}