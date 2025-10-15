import { z } from "zod";

export const ProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  health_score: z.number().min(0).max(100).default(100),
  metrics: z.record(z.any()).optional()
});

export const DeploymentSchema = z.object({
  project_id: z.number().int().positive(),
  environment: z.string().min(1),
  version: z.string().min(1),
  status: z.enum(["pending", "running", "completed", "failed", "approved", "rejected"]).optional(),
  metadata: z.record(z.any()).optional()
});

export const TestCaseSchema = z.object({
  project_id: z.number().int().positive(),
  name: z.string().min(1),
  input: z.record(z.any()),
  expected_output: z.record(z.any()),
  status: z.enum(["pending", "running", "passed", "failed"]).optional()
});

export const AlertRuleSchema = z.object({
  project_id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  condition: z.string().min(1),
  threshold: z.number(),
  notification_channel: z.string().min(1),
  enabled: z.boolean().default(true),
  severity: z.enum(["info", "warning", "error", "critical"]).optional(),
  cooldown_period: z.string().optional(),
  max_alerts_per_hour: z.number().int().positive().optional()
});

export const UserSchema = z.object({
  user_id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  avatar_url: z.string().url().optional(),
  role: z.enum(["admin", "developer", "viewer"]).default("developer")
});

export const BackupSchema = z.object({
  backup_name: z.string().min(1).max(255),
  description: z.string().optional(),
  backup_type: z.enum(["manual", "automatic", "scheduled"]).default("manual"),
  include_tables: z.array(z.string()).optional()
});

export const WidgetSchema = z.object({
  user_id: z.string().min(1),
  project_id: z.number().int().positive().optional(),
  widget_type: z.string().min(1),
  title: z.string().min(1).max(255),
  config: z.record(z.any()).optional(),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().positive(),
    h: z.number().int().positive()
  }).optional()
});

export const ApprovalRuleSchema = z.object({
  project_id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  environment: z.string().min(1),
  required_approvals: z.number().int().positive().default(1),
  auto_approve_after: z.string().optional(),
  allowed_approvers: z.array(z.number().int().positive()).optional(),
  conditions: z.record(z.any()).optional()
});

export const CommentSchema = z.object({
  project_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  entity_type: z.string().min(1),
  entity_id: z.number().int().positive(),
  content: z.string().min(1),
  parent_id: z.number().int().positive().optional()
});

export const AlertConditionSchema = z.object({
  alert_rule_id: z.number().int().positive(),
  condition_type: z.enum(["threshold", "anomaly", "pattern", "composite"]),
  metric_name: z.string().min(1),
  operator: z.enum(["gt", "lt", "gte", "lte", "eq", "neq"]),
  threshold_value: z.number(),
  aggregation: z.enum(["avg", "sum", "min", "max", "count"]).default("avg"),
  time_window: z.string().default("5 minutes"),
  evaluation_order: z.number().int().positive().default(1)
});

export const ErrorLogSchema = z.object({
  session_id: z.string().optional(),
  user_id: z.string().optional(),
  error_type: z.string().min(1),
  error_message: z.string().min(1),
  error_stack: z.string().optional(),
  component_stack: z.string().optional(),
  url: z.string().url().optional(),
  user_agent: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  severity: z.enum(["info", "warning", "error", "critical"]).default("error")
});

export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function validateSchemaAsync<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
  return schema.parseAsync(data);
}

export function isValidSchema<T>(schema: z.ZodSchema<T>, data: unknown): boolean {
  const result = schema.safeParse(data);
  return result.success;
}