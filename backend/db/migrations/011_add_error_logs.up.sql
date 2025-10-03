-- Error logs table
CREATE TABLE error_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_stack TEXT,
  url TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'error',
  is_resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_error_logs_session_id ON error_logs(session_id);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_is_resolved ON error_logs(is_resolved);