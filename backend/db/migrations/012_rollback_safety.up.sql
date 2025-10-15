CREATE TABLE IF NOT EXISTS migration_rollback_log (
  id BIGSERIAL PRIMARY KEY,
  migration_version TEXT NOT NULL,
  rollback_attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rollback_completed_at TIMESTAMPTZ,
  rollback_status TEXT NOT NULL DEFAULT 'pending',
  rollback_errors TEXT,
  table_snapshots JSONB DEFAULT '{}',
  affected_tables TEXT[],
  performed_by TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_migration_rollback_log_version ON migration_rollback_log(migration_version);
CREATE INDEX IF NOT EXISTS idx_migration_rollback_log_status ON migration_rollback_log(rollback_status);
CREATE INDEX IF NOT EXISTS idx_migration_rollback_log_attempted_at ON migration_rollback_log(rollback_attempted_at DESC);

CREATE TABLE IF NOT EXISTS migration_dependencies (
  id BIGSERIAL PRIMARY KEY,
  migration_version TEXT NOT NULL UNIQUE,
  depends_on_migrations TEXT[] DEFAULT ARRAY[]::TEXT[],
  dependent_migrations TEXT[] DEFAULT ARRAY[]::TEXT[],
  has_data_migration BOOLEAN NOT NULL DEFAULT false,
  has_destructive_changes BOOLEAN NOT NULL DEFAULT false,
  rollback_safe BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_dependencies_version ON migration_dependencies(migration_version);
CREATE INDEX IF NOT EXISTS idx_migration_dependencies_rollback_safe ON migration_dependencies(rollback_safe);

INSERT INTO migration_dependencies (migration_version, has_data_migration, has_destructive_changes, rollback_safe) VALUES
('001_create_schema', false, false, true),
('002_seed_data', true, false, true),
('003_add_missing_projects', true, false, true),
('004_add_context_snapshots', false, false, true),
('005_add_environments_and_rollback', false, false, true),
('006_add_backup_restore', false, false, true),
('007_add_collaboration', false, false, true),
('008_add_widgets', true, false, true),
('009_add_approval_workflow', false, false, true),
('010_add_advanced_alerting', false, false, true),
('011_add_error_logs', false, false, true)
ON CONFLICT (migration_version) DO NOTHING;

CREATE OR REPLACE FUNCTION validate_migration_rollback(target_migration TEXT)
RETURNS TABLE (
  can_rollback BOOLEAN,
  blocking_reasons TEXT[]
) AS $$
DECLARE
  dependent_migrations TEXT[];
  has_destructive BOOLEAN;
  reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT 
    md.dependent_migrations,
    md.has_destructive_changes
  INTO dependent_migrations, has_destructive
  FROM migration_dependencies md
  WHERE md.migration_version = target_migration;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['Migration version not found'];
    RETURN;
  END IF;
  
  IF has_destructive THEN
    reasons := array_append(reasons, 'Migration contains destructive changes');
  END IF;
  
  IF array_length(dependent_migrations, 1) > 0 THEN
    reasons := array_append(reasons, 
      'Migration has dependent migrations: ' || array_to_string(dependent_migrations, ', '));
  END IF;
  
  IF array_length(reasons, 1) = 0 THEN
    RETURN QUERY SELECT true, ARRAY[]::TEXT[];
  ELSE
    RETURN QUERY SELECT false, reasons;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_migration_rollback(
  p_migration_version TEXT,
  p_performed_by TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  rollback_id BIGINT;
BEGIN
  INSERT INTO migration_rollback_log (
    migration_version,
    performed_by,
    rollback_status
  ) VALUES (
    p_migration_version,
    p_performed_by,
    'in_progress'
  ) RETURNING id INTO rollback_id;
  
  RETURN rollback_id;
END;
$$ LANGUAGE plpgsql;