-- Note: context_snapshots table already exists from migration 001
-- This migration only adds deployment_logs table

CREATE TABLE IF NOT EXISTS deployment_logs (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  stage VARCHAR(50),
  progress INTEGER DEFAULT 0,
  logs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployment_logs_project_id ON deployment_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at ON deployment_logs(created_at DESC);