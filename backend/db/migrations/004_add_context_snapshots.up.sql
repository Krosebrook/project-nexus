CREATE TABLE context_snapshots (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_context_snapshots_project_id ON context_snapshots(project_id);
CREATE INDEX idx_context_snapshots_created_at ON context_snapshots(created_at DESC);

CREATE TABLE deployment_logs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  stage VARCHAR(50),
  progress INTEGER DEFAULT 0,
  logs TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deployment_logs_project_id ON deployment_logs(project_id);
CREATE INDEX idx_deployment_logs_created_at ON deployment_logs(created_at DESC);