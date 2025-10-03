export interface AlertCondition {
  id: number;
  alert_rule_id: number;
  condition_type: "threshold" | "anomaly" | "pattern" | "composite";
  metric_name: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
  threshold_value: number;
  aggregation: "avg" | "sum" | "min" | "max" | "count";
  time_window: string;
  evaluation_order: number;
  created_at: Date;
}

export interface AlertConditionGroup {
  id: number;
  alert_rule_id: number;
  name: string;
  logic_operator: "AND" | "OR";
  condition_ids: number[];
  created_at: Date;
}

export interface AlertAction {
  id: number;
  alert_rule_id: number;
  action_type: "email" | "webhook" | "slack" | "pagerduty" | "custom";
  action_config: Record<string, any>;
  execution_order: number;
  is_enabled: boolean;
  created_at: Date;
}

export interface AlertHistory {
  id: number;
  alert_rule_id: number;
  triggered_at: Date;
  resolved_at?: Date;
  severity: "info" | "warning" | "error" | "critical";
  metric_value?: number;
  threshold_value?: number;
  message: string;
  metadata: Record<string, any>;
  actions_taken: any[];
}

export interface AlertEscalation {
  id: number;
  alert_rule_id: number;
  escalation_level: number;
  delay_duration: string;
  notification_channels: string[];
  user_ids: number[];
  created_at: Date;
}

export interface CreateConditionRequest {
  alert_rule_id: number;
  condition_type: "threshold" | "anomaly" | "pattern" | "composite";
  metric_name: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
  threshold_value: number;
  aggregation?: "avg" | "sum" | "min" | "max" | "count";
  time_window?: string;
  evaluation_order?: number;
}

export interface CreateActionRequest {
  alert_rule_id: number;
  action_type: "email" | "webhook" | "slack" | "pagerduty" | "custom";
  action_config: Record<string, any>;
  execution_order?: number;
}

export interface CreateEscalationRequest {
  alert_rule_id: number;
  escalation_level: number;
  delay_duration: string;
  notification_channels: string[];
  user_ids?: number[];
}

export interface EvaluateRuleRequest {
  alert_rule_id: number;
  current_metrics?: Record<string, number>;
}

export interface EvaluationResult {
  triggered: boolean;
  conditions_met: number[];
  metric_values: Record<string, number>;
  message: string;
}