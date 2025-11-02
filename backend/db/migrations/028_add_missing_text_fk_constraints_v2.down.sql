-- v25a: Rollback FK constraints added by UP migration
-- Purpose: Drop FK constraints and indexes created in UP script
-- Safe & idempotent - only drops if constraints exist

BEGIN;

DO $$
DECLARE
  constraint_rec RECORD;
  index_rec RECORD;
BEGIN
  -- Drop FK constraints (only if they exist)
  FOR constraint_rec IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'f'
      AND con.conname IN (
        'dashboard_widgets_user_id_fkey',
        'user_preferences_user_id_fkey',
        'error_logs_user_id_fkey',
        'deployment_queue_requested_by_fkey',
        'deployment_schedules_created_by_fkey',
        'database_backups_created_by_fkey',
        'backup_restore_history_restored_by_fkey',
        'artifact_versions_created_by_fkey'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      constraint_rec.schema_name,
      constraint_rec.table_name,
      constraint_rec.constraint_name
    );
    RAISE NOTICE 'Dropped FK constraint % from %.%',
      constraint_rec.constraint_name,
      constraint_rec.schema_name,
      constraint_rec.table_name;
  END LOOP;

  -- Drop associated indexes
  FOR index_rec IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS index_name,
      t.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_class t ON t.oid = i.indrelid
    WHERE c.relkind = 'i'
      AND c.relname IN (
        'idx_dashboard_widgets_user_id_fk',
        'idx_user_preferences_user_id_fk',
        'idx_error_logs_user_id_fk',
        'idx_deployment_queue_requested_by_fk',
        'idx_deployment_schedules_created_by_fk',
        'idx_database_backups_created_by_fk',
        'idx_backup_restore_history_restored_by_fk',
        'idx_artifact_versions_created_by_fk'
      )
  LOOP
    EXECUTE format(
      'DROP INDEX IF EXISTS %I.%I',
      index_rec.schema_name,
      index_rec.index_name
    );
    RAISE NOTICE 'Dropped index % from table %',
      index_rec.index_name,
      index_rec.table_name;
  END LOOP;

  RAISE NOTICE 'FK rollback completed successfully';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error during FK rollback: % (SQLSTATE %)', SQLERRM, SQLSTATE;
  RAISE;
END $$;

COMMIT;
