-- Projects table
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  health_score INTEGER NOT NULL DEFAULT 100,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_last_activity ON projects(last_activity DESC);
CREATE INDEX idx_projects_health_score ON projects(health_score);

-- Context snapshots table
CREATE TABLE context_snapshots (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_state JSONB NOT NULL DEFAULT '{}',
  next_steps TEXT[],
  open_files TEXT[],
  notes TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_context_snapshots_project_id ON context_snapshots(project_id);
CREATE INDEX idx_context_snapshots_is_current ON context_snapshots(project_id, is_current);

-- Test cases table
CREATE TABLE test_cases (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  input JSONB NOT NULL,
  expected_output JSONB NOT NULL,
  actual_output JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX idx_test_cases_status ON test_cases(status);

-- Alert rules table
CREATE TABLE alert_rules (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  notification_channel TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_project_id ON alert_rules(project_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

-- File moves table
CREATE TABLE file_moves (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_path TEXT NOT NULL,
  new_path TEXT NOT NULL,
  reason TEXT,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_moves_project_id ON file_moves(project_id);
CREATE INDEX idx_file_moves_moved_at ON file_moves(moved_at DESC);

-- User preferences table
CREATE TABLE user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  refresh_interval INTEGER NOT NULL DEFAULT 30,
  default_view TEXT NOT NULL DEFAULT 'projects',
  theme TEXT NOT NULL DEFAULT 'dark',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
