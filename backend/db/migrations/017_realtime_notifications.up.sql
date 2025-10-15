CREATE TABLE IF NOT EXISTS deployment_notification_history (
  id BIGSERIAL PRIMARY KEY,
  deployment_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT,
  progress INTEGER,
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_deployment ON deployment_notification_history(deployment_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_project ON deployment_notification_history(project_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_created ON deployment_notification_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_timestamp ON deployment_notification_history(timestamp DESC);
