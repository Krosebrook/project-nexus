-- Post-Migration Integrity Checks for v25a FK Migration
-- Purpose: Verify FK constraints applied correctly and detect remaining orphan data
-- Run after migration deployment to validate database referential integrity

\echo '=== Post-Migration Integrity Check Report ==='
\echo ''

-- Check 1: Verify FK constraints exist
\echo '1. FK Constraint Verification:'
\echo '   Expected constraints on user_id/created_by/requested_by/restored_by columns'
\echo ''

SELECT
  conname AS constraint_name,
  conrelid::regclass AS on_table,
  confrelid::regclass AS references_table,
  CASE confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete_action
FROM pg_constraint
WHERE contype = 'f'
  AND (
    conname LIKE '%_user_id_fkey'
    OR conname LIKE '%_created_by_fkey'
    OR conname LIKE '%_requested_by_fkey'
    OR conname LIKE '%_restored_by_fkey'
    OR conname LIKE '%_initiated_by_fkey'
  )
ORDER BY on_table, conname;

\echo ''
\echo '2. Orphan Detection (Required FKs - should be ZERO):'
\echo ''

-- Required user_id columns (CASCADE)
WITH orphan_checks AS (
  SELECT
    'dashboard_widgets' AS table_name,
    COUNT(*) AS orphan_count
  FROM dashboard_widgets dw
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = dw.user_id)

  UNION ALL

  SELECT
    'user_preferences',
    COUNT(*)
  FROM user_preferences up
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = up.user_id)
)
SELECT
  table_name,
  orphan_count,
  CASE WHEN orphan_count = 0 THEN '✓ OK' ELSE '✗ FAIL' END AS status
FROM orphan_checks
ORDER BY table_name;

\echo ''
\echo '3. Orphan Detection (Nullable FKs - should be ZERO for non-null values):'
\echo ''

-- Nullable user_id columns (SET NULL)
WITH nullable_orphan_checks AS (
  SELECT
    'error_logs' AS table_name,
    COUNT(*) AS orphan_count
  FROM error_logs el
  WHERE el.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = el.user_id)

  UNION ALL

  SELECT
    'deployment_queue',
    COUNT(*)
  FROM deployment_queue dq
  WHERE dq.requested_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = dq.requested_by)

  UNION ALL

  SELECT
    'deployment_schedules',
    COUNT(*)
  FROM deployment_schedules ds
  WHERE ds.created_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = ds.created_by)

  UNION ALL

  SELECT
    'database_backups',
    COUNT(*)
  FROM database_backups db
  WHERE db.created_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = db.created_by)

  UNION ALL

  SELECT
    'backup_restore_history',
    COUNT(*)
  FROM backup_restore_history brh
  WHERE brh.restored_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = brh.restored_by)

  UNION ALL

  SELECT
    'artifact_versions',
    COUNT(*)
  FROM artifact_versions av
  WHERE av.created_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = av.created_by)
)
SELECT
  table_name,
  orphan_count,
  CASE WHEN orphan_count = 0 THEN '✓ OK' ELSE '✗ FAIL' END AS status
FROM nullable_orphan_checks
ORDER BY table_name;

\echo ''
\echo '4. Index Coverage for FK Columns:'
\echo ''

SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  i.relname AS index_name,
  a.attname AS column_name,
  ix.indisprimary AS is_primary,
  ix.indisunique AS is_unique
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE i.relname LIKE 'idx_%_fk'
  AND n.nspname = 'public'
ORDER BY t.relname, i.relname;

\echo ''
\echo '5. Table Existence Check:'
\echo ''

SELECT
  table_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = t.table_name)
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END AS status
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
ORDER BY table_name;

\echo ''
\echo '6. Summary Statistics:'
\echo ''

SELECT
  'Total FK Constraints' AS metric,
  COUNT(*)::TEXT AS value
FROM pg_constraint
WHERE contype = 'f'
  AND (
    conname LIKE '%_user_id_fkey'
    OR conname LIKE '%_created_by_fkey'
    OR conname LIKE '%_requested_by_fkey'
    OR conname LIKE '%_restored_by_fkey'
    OR conname LIKE '%_initiated_by_fkey'
  )

UNION ALL

SELECT
  'Total FK Indexes',
  COUNT(*)::TEXT
FROM pg_class
WHERE relkind = 'i'
  AND relname LIKE 'idx_%_fk'

UNION ALL

SELECT
  'Users in System',
  COUNT(*)::TEXT
FROM users;

\echo ''
\echo '=== End of Integrity Check ==='
\echo ''
\echo 'INTERPRETATION:'
\echo '  - All "orphan_count" values should be 0'
\echo '  - All tables should show "✓ EXISTS" unless intentionally absent'
\echo '  - Each FK column should have a corresponding index'
\echo '  - If migration_rollback_audit is MISSING, its FK was skipped (expected)'
\echo ''
