CREATE TABLE IF NOT EXISTS environments (
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

CREATE INDEX IF NOT EXISTS idx_environments_project_id ON environments(project_id);
CREATE INDEX IF NOT EXISTS idx_environments_type ON environments(type);
CREATE INDEX IF NOT EXISTS idx_environments_is_active ON environments(is_active);

ALTER TABLE deployment_logs 
  ADD COLUMN IF NOT EXISTS environment_id BIGINT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS rollback_from_deployment_id BIGINT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deployment_logs_environment_id_fkey'
  ) THEN
    ALTER TABLE deployment_logs 
      ADD CONSTRAINT deployment_logs_environment_id_fkey 
      FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deployment_logs_rollback_from_deployment_id_fkey'
  ) THEN
    ALTER TABLE deployment_logs 
      ADD CONSTRAINT deployment_logs_rollback_from_deployment_id_fkey 
      FOREIGN KEY (rollback_from_deployment_id) REFERENCES deployment_logs(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deployment_logs_status_check'
  ) THEN
    ALTER TABLE deployment_logs 
      ADD CONSTRAINT deployment_logs_status_check 
      CHECK (status IN ('pending', 'in_progress', 'success', 'failed', 'rolled_back'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deployment_logs_environment_id ON deployment_logs(environment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_status ON deployment_logs(status);

CREATE TABLE IF NOT EXISTS deployment_comparisons (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deployment_a_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  deployment_b_id BIGINT NOT NULL REFERENCES deployment_logs(id) ON DELETE CASCADE,
  diff_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployment_comparisons_project_id ON deployment_comparisons(project_id);

CREATE TABLE IF NOT EXISTS test_coverage (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deployment_id BIGINT REFERENCES deployment_logs(id) ON DELETE SET NULL,
  total_lines INTEGER NOT NULL,
  covered_lines INTEGER NOT NULL,
  coverage_percentage DOUBLE PRECISION NOT NULL,
  file_coverage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_coverage_project_id ON test_coverage(project_id);
CREATE INDEX IF NOT EXISTS idx_test_coverage_deployment_id ON test_coverage(deployment_id);
CREATE INDEX IF NOT EXISTS idx_test_coverage_created_at ON test_coverage(created_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
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

CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_deployment_id ON incidents(deployment_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);

CREATE TABLE IF NOT EXISTS project_dependencies (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  depends_on_project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('direct', 'transitive', 'dev')),
  version_constraint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, depends_on_project_id),
  CHECK (project_id != depends_on_project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_dependencies_project_id ON project_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_project_dependencies_depends_on ON project_dependencies(depends_on_project_id);