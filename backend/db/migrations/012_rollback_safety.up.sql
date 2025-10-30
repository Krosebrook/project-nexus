CREATE TABLE IF NOT EXISTS migration_rollback_audit (
  id BIGSERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL,
  migration_version TEXT NOT NULL,
  rollback_type TEXT NOT NULL,
  initiated_by TEXT,
  safety_checks_passed BOOLEAN NOT NULL DEFAULT false,
  affected_tables TEXT[],
  affected_records_count JSONB DEFAULT '{}',
  warnings TEXT[],
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT
);

CREATE INDEX idx_rollback_audit_migration_name ON migration_rollback_audit(migration_name);
CREATE INDEX idx_rollback_audit_executed_at ON migration_rollback_audit(executed_at DESC);
CREATE INDEX idx_rollback_audit_status ON migration_rollback_audit(status);

CREATE TABLE IF NOT EXISTS migration_dependencies (
  id BIGSERIAL PRIMARY KEY,
  parent_table TEXT NOT NULL,
  child_table TEXT NOT NULL,
  foreign_key_name TEXT NOT NULL,
  on_delete_action TEXT NOT NULL DEFAULT 'NO ACTION',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_table, child_table, foreign_key_name)
);

CREATE INDEX idx_migration_dependencies_parent ON migration_dependencies(parent_table);
CREATE INDEX idx_migration_dependencies_child ON migration_dependencies(child_table);

INSERT INTO migration_dependencies (parent_table, child_table, foreign_key_name, on_delete_action) VALUES
  ('projects', 'deployment_logs', 'deployment_logs_project_id_fkey', 'CASCADE'),
  ('projects', 'test_cases', 'test_cases_project_id_fkey', 'CASCADE'),
  ('projects', 'alert_rules', 'alert_rules_project_id_fkey', 'CASCADE'),
  ('deployment_logs', 'deployment_artifacts', 'deployment_artifacts_deployment_id_fkey', 'CASCADE'),
  ('deployment_logs', 'deployment_diffs', 'deployment_diffs_deployment_a_fkey', 'CASCADE'),
  ('deployment_logs', 'deployment_queue', 'deployment_queue_deployment_id_fkey', 'SET NULL')
ON CONFLICT (parent_table, child_table, foreign_key_name) DO NOTHING;

CREATE OR REPLACE FUNCTION check_orphaned_records(
  p_table_name TEXT,
  p_referenced_table TEXT,
  p_foreign_key_column TEXT
)
RETURNS JSONB AS $$
DECLARE
  orphan_count BIGINT;
  result JSONB;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE %I NOT IN (SELECT id FROM %I)',
    p_table_name,
    p_foreign_key_column,
    p_referenced_table
  ) INTO orphan_count;
  
  result := jsonb_build_object(
    'table', p_table_name,
    'orphaned_count', orphan_count,
    'has_orphans', orphan_count > 0
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_active_deployments()
RETURNS JSONB AS $$
DECLARE
  active_count BIGINT;
  result JSONB;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM deployment_logs
  WHERE status IN ('running', 'pending', 'queued');
  
  result := jsonb_build_object(
    'active_deployments', active_count,
    'has_active', active_count > 0,
    'warning', CASE 
      WHEN active_count > 0 
      THEN format('%s active deployments will be affected', active_count)
      ELSE NULL
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
