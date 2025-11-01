CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  operation TEXT NOT NULL,
  data JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  client_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  synced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_events_version ON sync_events(version);
CREATE INDEX idx_sync_events_client ON sync_events(client_id);
CREATE INDEX idx_sync_events_synced_timestamp ON sync_events(synced, timestamp);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  local_version INTEGER NOT NULL,
  remote_version INTEGER NOT NULL,
  local_data JSONB NOT NULL,
  remote_data JSONB NOT NULL,
  resolution TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_conflicts_resolution ON sync_conflicts(resolution);
CREATE INDEX idx_sync_conflicts_created_at ON sync_conflicts(created_at);

ALTER TABLE deployment_logs ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deployment_artifacts ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deployment_queue ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
