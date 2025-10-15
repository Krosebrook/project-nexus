-- Custom dashboard widgets table
CREATE TABLE dashboard_widgets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 4, "h": 3}',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widgets_user_id ON dashboard_widgets(user_id);
CREATE INDEX idx_widgets_project_id ON dashboard_widgets(project_id);
CREATE INDEX idx_widgets_widget_type ON dashboard_widgets(widget_type);
CREATE INDEX idx_widgets_is_visible ON dashboard_widgets(is_visible);

-- Widget templates table
CREATE TABLE widget_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  widget_type TEXT NOT NULL,
  default_config JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL,
  icon TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_templates_widget_type ON widget_templates(widget_type);
CREATE INDEX idx_widget_templates_category ON widget_templates(category);
CREATE INDEX idx_widget_templates_is_public ON widget_templates(is_public);

-- Insert default widget templates
INSERT INTO widget_templates (name, description, widget_type, default_config, category, icon) VALUES
('Deployment Status', 'Shows current deployment status', 'deployment_status', '{"showHistory": true, "limit": 5}', 'deployments', 'rocket'),
('Test Coverage', 'Displays test coverage metrics', 'test_coverage', '{"chartType": "donut", "threshold": 80}', 'testing', 'shield-check'),
('Active Alerts', 'Lists active alerts', 'active_alerts', '{"showResolved": false, "limit": 10}', 'monitoring', 'bell'),
('Project Health', 'Shows project health score', 'project_health', '{"displayType": "gauge"}', 'metrics', 'heart-pulse'),
('Recent Activity', 'Shows recent project activity', 'recent_activity', '{"limit": 15, "filterType": "all"}', 'activity', 'activity'),
('Performance Metrics', 'Displays performance graphs', 'performance_metrics', '{"metrics": ["response_time", "throughput"], "timeRange": "24h"}', 'metrics', 'bar-chart'),
('Team Presence', 'Shows online team members', 'team_presence', '{"showOffline": false}', 'collaboration', 'users'),
('Quick Actions', 'Quick action buttons', 'quick_actions', '{"actions": ["deploy", "rollback", "run_tests"]}', 'actions', 'zap');