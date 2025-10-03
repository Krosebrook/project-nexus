-- Advanced alert conditions table
CREATE TABLE alert_conditions (
  id BIGSERIAL PRIMARY KEY,
  alert_rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold_value DOUBLE PRECISION NOT NULL,
  aggregation TEXT DEFAULT 'avg',
  time_window INTERVAL DEFAULT '5 minutes',
  evaluation_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_conditions_alert_rule_id ON alert_conditions(alert_rule_id);
CREATE INDEX idx_alert_conditions_metric_name ON alert_conditions(metric_name);

-- Alert condition groups (for AND/OR logic)
CREATE TABLE alert_condition_groups (
  id BIGSERIAL PRIMARY KEY,
  alert_rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logic_operator TEXT NOT NULL DEFAULT 'AND',
  condition_ids BIGINT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_condition_groups_alert_rule_id ON alert_condition_groups(alert_rule_id);

-- Alert actions table
CREATE TABLE alert_actions (
  id BIGSERIAL PRIMARY KEY,
  alert_rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  execution_order INTEGER NOT NULL DEFAULT 1,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_actions_alert_rule_id ON alert_actions(alert_rule_id);
CREATE INDEX idx_alert_actions_action_type ON alert_actions(action_type);

-- Alert history table
CREATE TABLE alert_history (
  id BIGSERIAL PRIMARY KEY,
  alert_rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  severity TEXT NOT NULL,
  metric_value DOUBLE PRECISION,
  threshold_value DOUBLE PRECISION,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  actions_taken JSONB DEFAULT '[]'
);

CREATE INDEX idx_alert_history_alert_rule_id ON alert_history(alert_rule_id);
CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggered_at DESC);
CREATE INDEX idx_alert_history_severity ON alert_history(severity);
CREATE INDEX idx_alert_history_resolved_at ON alert_history(resolved_at);

-- Alert escalations table
CREATE TABLE alert_escalations (
  id BIGSERIAL PRIMARY KEY,
  alert_rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  escalation_level INTEGER NOT NULL,
  delay_duration INTERVAL NOT NULL,
  notification_channels TEXT[] NOT NULL,
  user_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_escalations_alert_rule_id ON alert_escalations(alert_rule_id);
CREATE INDEX idx_alert_escalations_escalation_level ON alert_escalations(escalation_level);

-- Add new columns to alert_rules
ALTER TABLE alert_rules ADD COLUMN severity TEXT DEFAULT 'warning';
ALTER TABLE alert_rules ADD COLUMN cooldown_period INTERVAL DEFAULT '15 minutes';
ALTER TABLE alert_rules ADD COLUMN max_alerts_per_hour INTEGER DEFAULT 10;
ALTER TABLE alert_rules ADD COLUMN enable_escalation BOOLEAN DEFAULT false;