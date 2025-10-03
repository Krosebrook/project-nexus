CREATE TABLE environments (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('development', 'staging', 'production')),
  url TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE INDEX idx_environments_project_id ON environments(project_id);
CREATE INDEX idx_environments_type ON environments(type);
CREATE INDEX idx_environments_is_active ON environments(is_active);

CREATE TABLE deployment_logs (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id BIGINT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'success', 'failed', 'rolled_back')),
  stage TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  logs TEXT,
  error_message TEXT,
  rollback_from_deployment_id BIGINT REFERENCES deployment_logs(id),
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_logs_project_id ON deployment_logs(project_id);
CREATE INDEX idx_deployment_logs_environment_id ON deployment_logs(environment_id);
CREATE INDEX idx_deployment_logs_status ON deployment_logs(status);
CREATE INDEX idx_deployment_logs_created_at ON deployment_logs(created_at DESC);

CREATE TABLE deployment_comparisons (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deployment_a_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  deployment_b_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  diff_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_comparisons_project_id ON deployment_comparisons(project_id);

CREATE TABLE test_coverage (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deployment_id BIGINT REFERENCES deployment_logs(id) ON DELETE SET NULL,
  total_lines INTEGER NOT NULL,
  covered_lines INTEGER NOT NULL,
  coverage_percentage DOUBLE PRECISION NOT NULL,
  file_coverage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_coverage_project_id ON test_coverage(project_id);
CREATE INDEX idx_test_coverage_deployment_id ON test_coverage(deployment_id);
CREATE INDEX idx_test_coverage_created_at ON test_coverage(created_at DESC);

CREATE TABLE incidents (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deployment_id BIGINT REFERENCES deployment_logs(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_project_id ON incidents(project_id);
CREATE INDEX idx_incidents_deployment_id ON incidents(deployment_id);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);

CREATE TABLE project_dependencies (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  depends_on_project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('direct', 'transitive', 'dev')),
  version_constraint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, depends_on_project_id),
  CHECK (project_id != depends_on_project_id)
);

CREATE INDEX idx_project_dependencies_project_id ON project_dependencies(project_id);
CREATE INDEX idx_project_dependencies_depends_on ON project_dependencies(depends_on_project_id);