CREATE TABLE deployment_queue (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id BIGINT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  deployment_id BIGINT REFERENCES deployment_logs(id) ON DELETE SET NULL,
  queue_position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  requested_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deployment_queue_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_deployment_queue_project_id ON deployment_queue(project_id);
CREATE INDEX idx_deployment_queue_environment_id ON deployment_queue(environment_id);
CREATE INDEX idx_deployment_queue_status ON deployment_queue(status);
CREATE INDEX idx_deployment_queue_scheduled_at ON deployment_queue(scheduled_at);
CREATE INDEX idx_deployment_queue_priority ON deployment_queue(priority DESC);
CREATE INDEX idx_deployment_queue_position ON deployment_queue(queue_position);

CREATE TABLE deployment_schedules (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id BIGINT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cron_expression TEXT,
  scheduled_time TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_execution TIMESTAMPTZ,
  next_execution TIMESTAMPTZ,
  deployment_config JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_schedules_project_id ON deployment_schedules(project_id);
CREATE INDEX idx_deployment_schedules_environment_id ON deployment_schedules(environment_id);
CREATE INDEX idx_deployment_schedules_is_active ON deployment_schedules(is_active);
CREATE INDEX idx_deployment_schedules_next_execution ON deployment_schedules(next_execution);

CREATE OR REPLACE FUNCTION update_queue_positions()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status != 'queued') THEN
    UPDATE deployment_queue
    SET queue_position = queue_position - 1
    WHERE environment_id = COALESCE(NEW.environment_id, OLD.environment_id)
      AND status = 'queued'
      AND queue_position > COALESCE(OLD.queue_position, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_queue_positions
AFTER UPDATE OR DELETE ON deployment_queue
FOR EACH ROW
EXECUTE FUNCTION update_queue_positions();