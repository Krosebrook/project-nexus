-- v25a: Hardened FK Migration with Table/Column Existence Checks
-- Purpose: Add missing user_id FKs to existing tables only; skip when table/column absent
-- Idempotent & safe on re-run; handles missing migration_rollback_audit gracefully

BEGIN;

-- Helper: Test if table exists (case-insensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'table_exists_ci' AND pg_function_is_visible(oid)
  ) THEN
    CREATE OR REPLACE FUNCTION table_exists_ci(p_schema TEXT, p_table TEXT)
    RETURNS BOOLEAN LANGUAGE plpgsql AS $func$
    DECLARE v_exists BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = p_schema
          AND LOWER(table_name) = LOWER(p_table)
      ) INTO v_exists;
      RETURN v_exists;
    END;
    $func$;
  END IF;
END $$;

-- Helper: Add FK only if source table, column, and target exist; constraint missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'add_fk_if_possible' AND pg_function_is_visible(oid)
  ) THEN
    CREATE OR REPLACE FUNCTION add_fk_if_possible(
      src_schema TEXT,
      src_table TEXT,
      src_col TEXT,
      tgt_table TEXT,
      tgt_pk TEXT,
      fk_name TEXT,
      on_delete_action TEXT,
      is_nullable BOOLEAN
    ) RETURNS VOID LANGUAGE plpgsql AS $func$
    DECLARE
      v_src_table_exists BOOLEAN;
      v_src_col_exists   BOOLEAN;
      v_tgt_table_exists BOOLEAN;
      v_con_exists       BOOLEAN;
      v_orphan_count     BIGINT;
    BEGIN
      SELECT table_exists_ci(src_schema, src_table) INTO v_src_table_exists;
      SELECT table_exists_ci('public', tgt_table) INTO v_tgt_table_exists;

      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = src_schema
          AND LOWER(table_name) = LOWER(src_table)
          AND LOWER(column_name) = LOWER(src_col)
      ) INTO v_src_col_exists;

      SELECT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = fk_name
      ) INTO v_con_exists;

      IF NOT v_src_table_exists THEN
        RAISE NOTICE 'Skipping FK % - source table %.% does not exist', fk_name, src_schema, src_table;
        RETURN;
      END IF;

      IF NOT v_src_col_exists THEN
        RAISE NOTICE 'Skipping FK % - column %.%.% does not exist', fk_name, src_schema, src_table, src_col;
        RETURN;
      END IF;

      IF NOT v_tgt_table_exists THEN
        RAISE NOTICE 'Skipping FK % - target table % does not exist', fk_name, tgt_table;
        RETURN;
      END IF;

      IF v_con_exists THEN
        RAISE NOTICE 'Skipping FK % - constraint already exists', fk_name;
        RETURN;
      END IF;

      -- Clean orphans before adding FK
      IF is_nullable THEN
        EXECUTE format(
          'UPDATE %I.%I SET %I = NULL WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM %I)',
          src_schema, src_table, src_col, src_col, src_col, tgt_pk, tgt_table
        );
        GET DIAGNOSTICS v_orphan_count = ROW_COUNT;
        IF v_orphan_count > 0 THEN
          RAISE NOTICE 'Nullified % orphan references in %.%.%', v_orphan_count, src_schema, src_table, src_col;
        END IF;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I WHERE %I NOT IN (SELECT %I FROM %I)',
          src_schema, src_table, src_col, tgt_pk, tgt_table
        );
        GET DIAGNOSTICS v_orphan_count = ROW_COUNT;
        IF v_orphan_count > 0 THEN
          RAISE WARNING 'Deleted % orphan rows from %.%.% (required FK)', v_orphan_count, src_schema, src_table, src_col;
        END IF;
      END IF;

      -- Add FK constraint
      EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s',
        src_schema, src_table, fk_name, src_col, tgt_table, tgt_pk, on_delete_action
      );
      RAISE NOTICE 'Added FK % on %.%.% → %.%', fk_name, src_schema, src_table, src_col, tgt_table, tgt_pk;

      -- Create index for FK lookups
      IF is_nullable THEN
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I.%I(%I) WHERE %I IS NOT NULL',
          'idx_' || src_table || '_' || src_col || '_fk',
          src_schema, src_table, src_col, src_col
        );
      ELSE
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I.%I(%I)',
          'idx_' || src_table || '_' || src_col || '_fk',
          src_schema, src_table, src_col
        );
      END IF;
      RAISE NOTICE 'Created index idx_%_%_fk', src_table, src_col;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to add FK %: % (SQLSTATE %)', fk_name, SQLERRM, SQLSTATE;
    END;
    $func$;
  END IF;
END $$;

-- Add FKs (required columns - CASCADE on delete)
SELECT add_fk_if_possible(
  'public', 'dashboard_widgets', 'user_id',
  'users', 'user_id',
  'dashboard_widgets_user_id_fkey',
  'CASCADE', false
);

SELECT add_fk_if_possible(
  'public', 'user_preferences', 'user_id',
  'users', 'user_id',
  'user_preferences_user_id_fkey',
  'CASCADE', false
);

-- Add FKs (nullable columns - SET NULL on delete)
SELECT add_fk_if_possible(
  'public', 'error_logs', 'user_id',
  'users', 'user_id',
  'error_logs_user_id_fkey',
  'SET NULL', true
);

SELECT add_fk_if_possible(
  'public', 'deployment_queue', 'requested_by',
  'users', 'user_id',
  'deployment_queue_requested_by_fkey',
  'SET NULL', true
);

SELECT add_fk_if_possible(
  'public', 'deployment_schedules', 'created_by',
  'users', 'user_id',
  'deployment_schedules_created_by_fkey',
  'SET NULL', true
);

SELECT add_fk_if_possible(
  'public', 'database_backups', 'created_by',
  'users', 'user_id',
  'database_backups_created_by_fkey',
  'SET NULL', true
);

SELECT add_fk_if_possible(
  'public', 'backup_restore_history', 'restored_by',
  'users', 'user_id',
  'backup_restore_history_restored_by_fkey',
  'SET NULL', true
);

SELECT add_fk_if_possible(
  'public', 'artifact_versions', 'created_by',
  'users', 'user_id',
  'artifact_versions_created_by_fkey',
  'SET NULL', true
);

-- Cleanup: Drop helper functions after use
DROP FUNCTION IF EXISTS add_fk_if_possible(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS table_exists_ci(TEXT, TEXT);

COMMIT;
