-- Preflight Schema Existence Check for v25a FK Migration
-- Purpose: Verify which tables and columns exist before attempting migration
-- Run in CI/CD pipeline before migration to prevent SQLSTATE 42P01 errors

\echo '=== Preflight Schema Check for FK Migration v25a ==='
\echo ''

\echo '1. Table Existence Check:'
\echo '   Verifying all candidate tables for FK constraints...'
\echo ''

SELECT
  t.table_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND information_schema.tables.table_name = t.table_name
    )
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END AS status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND information_schema.tables.table_name = t.table_name
    )
    THEN (
      SELECT pg_size_pretty(pg_total_relation_size(quote_ident('public') || '.' || quote_ident(t.table_name)))
    )
    ELSE 'N/A'
  END AS size
FROM (VALUES
  ('users'),
  ('dashboard_widgets'),
  ('user_preferences'),
  ('error_logs'),
  ('deployment_queue'),
  ('deployment_schedules'),
  ('database_backups'),
  ('backup_restore_history'),
  ('artifact_versions'),
  ('migration_rollback_audit')
) AS t(table_name)
ORDER BY
  CASE WHEN t.table_name = 'users' THEN 0 ELSE 1 END,
  t.table_name;

\echo ''
\echo '2. Column Existence Check:'
\echo '   Verifying FK source columns exist in their tables...'
\echo ''

WITH column_checks AS (
  SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name = c.table_name
    ) AS table_exists,
    EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = c.table_name
        AND ic.column_name = c.column_name
    ) AS column_exists
  FROM (VALUES
    ('dashboard_widgets', 'user_id', 'text', 'NO'),
    ('user_preferences', 'user_id', 'text', 'NO'),
    ('error_logs', 'user_id', 'text', 'YES'),
    ('deployment_queue', 'requested_by', 'text', 'YES'),
    ('deployment_schedules', 'created_by', 'text', 'YES'),
    ('database_backups', 'created_by', 'text', 'YES'),
    ('backup_restore_history', 'restored_by', 'text', 'YES'),
    ('artifact_versions', 'created_by', 'text', 'YES'),
    ('migration_rollback_audit', 'initiated_by', 'text', 'YES')
  ) AS c(table_name, column_name, data_type, is_nullable)
)
SELECT
  table_name,
  column_name,
  data_type AS expected_type,
  is_nullable AS expected_nullable,
  CASE
    WHEN NOT table_exists THEN '⊘ TABLE MISSING'
    WHEN NOT column_exists THEN '✗ COLUMN MISSING'
    ELSE '✓ EXISTS'
  END AS status
FROM column_checks
ORDER BY table_name, column_name;

\echo ''
\echo '3. Target Table Check (users):'
\echo '   Verifying reference target exists and has data...'
\echo ''

DO $$
DECLARE
  v_user_count BIGINT;
  v_has_pk BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    SELECT COUNT(*) INTO v_user_count FROM users;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND constraint_type = 'PRIMARY KEY'
    ) INTO v_has_pk;

    RAISE NOTICE 'users table: ✓ EXISTS';
    RAISE NOTICE 'users.user_id PK: %', CASE WHEN v_has_pk THEN '✓ EXISTS' ELSE '✗ MISSING' END;
    RAISE NOTICE 'Total users: %', v_user_count;

    IF v_user_count = 0 THEN
      RAISE WARNING 'users table is EMPTY - FK constraints will succeed but data may be deleted!';
    END IF;
  ELSE
    RAISE WARNING 'users table: ✗ MISSING - ALL FK constraints will be skipped!';
  END IF;
END $$;

\echo ''
\echo '4. Existing FK Constraint Check:'
\echo '   Checking if any target constraints already exist...'
\echo ''

SELECT
  conname AS constraint_name,
  conrelid::regclass AS on_table,
  CASE
    WHEN conname IN (
      'dashboard_widgets_user_id_fkey',
      'user_preferences_user_id_fkey',
      'error_logs_user_id_fkey',
      'deployment_queue_requested_by_fkey',
      'deployment_schedules_created_by_fkey',
      'database_backups_created_by_fkey',
      'backup_restore_history_restored_by_fkey',
      'artifact_versions_created_by_fkey',
      'migration_rollback_audit_initiated_by_fkey'
    )
    THEN '⚠ ALREADY EXISTS'
    ELSE 'OTHER'
  END AS status
FROM pg_constraint
WHERE contype = 'f'
  AND conname IN (
    'dashboard_widgets_user_id_fkey',
    'user_preferences_user_id_fkey',
    'error_logs_user_id_fkey',
    'deployment_queue_requested_by_fkey',
    'deployment_schedules_created_by_fkey',
    'database_backups_created_by_fkey',
    'backup_restore_history_restored_by_fkey',
    'artifact_versions_created_by_fkey',
    'migration_rollback_audit_initiated_by_fkey'
  );

\echo ''
\echo '5. Orphan Data Preview:'
\echo '   Checking for orphan records that will be cleaned...'
\echo ''

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  -- Required FKs (will DELETE orphans)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dashboard_widgets')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    SELECT COUNT(*) INTO v_count
    FROM dashboard_widgets dw
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = dw.user_id);
    RAISE NOTICE 'dashboard_widgets orphans (will DELETE): %', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    SELECT COUNT(*) INTO v_count
    FROM user_preferences up
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = up.user_id);
    RAISE NOTICE 'user_preferences orphans (will DELETE): %', v_count;
  END IF;

  -- Nullable FKs (will SET NULL)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'error_logs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    SELECT COUNT(*) INTO v_count
    FROM error_logs el
    WHERE el.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = el.user_id);
    RAISE NOTICE 'error_logs orphans (will SET NULL): %', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deployment_queue')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    SELECT COUNT(*) INTO v_count
    FROM deployment_queue dq
    WHERE dq.requested_by IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = dq.requested_by);
    RAISE NOTICE 'deployment_queue orphans (will SET NULL): %', v_count;
  END IF;
END $$;

\echo ''
\echo '6. Migration Readiness Summary:'
\echo ''

DO $$
DECLARE
  v_users_exists BOOLEAN;
  v_missing_tables INT;
  v_ready TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO v_users_exists;

  SELECT COUNT(*) INTO v_missing_tables
  FROM (VALUES
    ('dashboard_widgets'),
    ('user_preferences'),
    ('error_logs'),
    ('deployment_queue'),
    ('deployment_schedules'),
    ('database_backups'),
    ('backup_restore_history'),
    ('artifact_versions')
  ) AS t(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND information_schema.tables.table_name = t.table_name
  );

  IF v_users_exists AND v_missing_tables = 0 THEN
    v_ready := '✓ READY - All tables present';
  ELSIF v_users_exists THEN
    v_ready := '⚠ PARTIAL - Some tables missing (' || v_missing_tables || ') but migration will skip them';
  ELSE
    v_ready := '✗ NOT READY - users table missing, ALL constraints will be skipped';
  END IF;

  RAISE NOTICE '%', v_ready;
END $$;

\echo ''
\echo '=== End of Preflight Check ==='
\echo ''
\echo 'GUIDANCE:'
\echo '  - ✓ EXISTS: Migration will process this table/column'
\echo '  - ✗ MISSING: Migration will skip this table/column (safe)'
\echo '  - ⚠ ALREADY EXISTS: Constraint exists, will be skipped (idempotent)'
\echo '  - Orphan counts show data that will be cleaned during migration'
\echo ''
