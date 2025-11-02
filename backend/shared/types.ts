export type Status = "active" | "inactive" | "archived" | "pending" | "completed" | "failed";

export type DeploymentStatus = "pending" | "running" | "completed" | "failed" | "approved" | "rejected" | "cancelled";

export type TestStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export type AlertSeverity = "info" | "warning" | "error" | "critical";

export type UserRole = "admin" | "developer" | "viewer";

export type BackupType = "manual" | "automatic" | "scheduled";

export type ConditionOperator = "gt" | "lt" | "gte" | "lte" | "eq" | "neq";

export type AggregationType = "avg" | "sum" | "min" | "max" | "count";

export type ConditionType = "threshold" | "anomaly" | "pattern" | "composite";

export interface BaseEntity {
  id: number;
  created_at: Date;
  updated_at: Date;
}

export interface SoftDeletableEntity extends BaseEntity {
  deleted_at?: Date | null;
}

export interface UserOwnedEntity {
  user_id: string;
}

export interface ProjectOwnedEntity {
  project_id: number;
}

export interface Timestamped {
  created_at: Date;
  updated_at: Date;
}

export interface Metadata {
  [key: string]: any;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface SortParams {
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}

export interface FilterParams {
  search?: string;
  status?: string;
  [key: string]: any;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Position {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DeploymentChecklist {
  tests_passed: boolean;
  breaking_changes_documented: boolean;
  migrations_ready: boolean;
}

export interface HealthMetrics {
  avg_response_time?: number;
  error_rate?: number;
  uptime_pct?: number;
  cpu_usage?: number;
  memory_usage?: number;
  active_connections?: number;
  requests_per_minute?: number;
}

export interface NotificationChannel {
  type: "email" | "slack" | "webhook" | "sms";
  config: Record<string, any>;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
}

export interface CacheConfig {
  ttl: number;
  maxSize?: number;
}

export interface AuditLog {
  action: string;
  entity_type: string;
  entity_id: number;
  user_id?: string;
  changes?: Record<string, any>;
  timestamp: Date;
}

export type EntityType = 
  | "project" 
  | "deployment" 
  | "test_case" 
  | "alert_rule" 
  | "backup" 
  | "widget" 
  | "approval_rule" 
  | "comment" 
  | "environment" 
  | "snapshot";
