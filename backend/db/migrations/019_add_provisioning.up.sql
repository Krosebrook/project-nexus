CREATE TABLE IF NOT EXISTS provisioned_databases (
  id TEXT PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('neon', 'supabase', 'planetscale')),
  region TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('provisioning', 'active', 'failed', 'deleting', 'deleted')),

  neon_project_id TEXT,
  connection_string TEXT,
  host TEXT,
  port INTEGER,
  database_name TEXT,
  username TEXT,
  password_encrypted TEXT,

  gcp_service_account_email TEXT,
  gcp_service_account_key_encrypted TEXT,

  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, provider, name)
);

CREATE INDEX IF NOT EXISTS idx_provisioned_databases_project_id ON provisioned_databases(project_id);
CREATE INDEX IF NOT EXISTS idx_provisioned_databases_status ON provisioned_databases(status);
CREATE INDEX IF NOT EXISTS idx_provisioned_databases_provider ON provisioned_databases(provider);

CREATE TABLE IF NOT EXISTS database_connection_logs (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES provisioned_databases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('connection_success', 'connection_failed', 'query_executed', 'pool_created', 'pool_closed')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_database_connection_logs_database_id ON database_connection_logs(database_id);
CREATE INDEX IF NOT EXISTS idx_database_connection_logs_created_at ON database_connection_logs(created_at);

