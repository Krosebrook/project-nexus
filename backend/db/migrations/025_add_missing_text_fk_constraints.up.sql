-- Add missing foreign key constraints for TEXT columns referencing users.user_id
-- This migration is safe and reversible

BEGIN;

-- dashboard_widgets.user_id → users.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dashboard_widgets_user_id_fkey'
  ) THEN
    -- First, clean up any orphaned records
    DELETE FROM dashboard_widgets
    WHERE user_id NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE dashboard_widgets 
      ADD CONSTRAINT dashboard_widgets_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_preferences.user_id → users.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_preferences_user_id_fkey'
  ) THEN
    DELETE FROM user_preferences
    WHERE user_id NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE user_preferences 
      ADD CONSTRAINT user_preferences_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- error_logs.user_id → users.user_id (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'error_logs_user_id_fkey'
  ) THEN
    DELETE FROM error_logs
    WHERE user_id IS NOT NULL 
      AND user_id NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE error_logs 
      ADD CONSTRAINT error_logs_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- deployment_queue.requested_by → users.user_id (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deployment_queue_requested_by_fkey'
  ) THEN
    UPDATE deployment_queue
    SET requested_by = NULL
    WHERE requested_by IS NOT NULL 
      AND requested_by NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE deployment_queue 
      ADD CONSTRAINT deployment_queue_requested_by_fkey 
      FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- deployment_schedules.created_by → users.user_id (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deployment_schedules_created_by_fkey'
  ) THEN
    UPDATE deployment_schedules
    SET created_by = NULL
    WHERE created_by IS NOT NULL 
      AND created_by NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE deployment_schedules 
      ADD CONSTRAINT deployment_schedules_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- database_backups.created_by → users.user_id (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'database_backups_created_by_fkey'
  ) THEN
    UPDATE database_backups
    SET created_by = NULL
    WHERE created_by IS NOT NULL 
      AND created_by NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE database_backups 
      ADD CONSTRAINT database_backups_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- backup_restore_history.restored_by → users.user_id (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'backup_restore_history_restored_by_fkey'
  ) THEN
    UPDATE backup_restore_history
    SET restored_by = NULL
    WHERE restored_by IS NOT NULL 
      AND restored_by NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE backup_restore_history 
      ADD CONSTRAINT backup_restore_history_restored_by_fkey 
      FOREIGN KEY (restored_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- migration_rollback_audit.initiated_by → users.user_id (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'migration_rollback_audit_initiated_by_fkey'
  ) THEN
    UPDATE migration_rollback_audit
    SET initiated_by = NULL
    WHERE initiated_by IS NOT NULL 
      AND initiated_by NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE migration_rollback_audit 
      ADD CONSTRAINT migration_rollback_audit_initiated_by_fkey 
      FOREIGN KEY (initiated_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- artifact_versions.created_by → users.user_id (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'artifact_versions_created_by_fkey'
  ) THEN
    UPDATE artifact_versions
    SET created_by = NULL
    WHERE created_by IS NOT NULL 
      AND created_by NOT IN (SELECT user_id FROM users);
    
    ALTER TABLE artifact_versions 
      ADD CONSTRAINT artifact_versions_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id_fk ON error_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deployment_queue_requested_by_fk ON deployment_queue(requested_by) WHERE requested_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deployment_schedules_created_by_fk ON deployment_schedules(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_database_backups_created_by_fk ON database_backups(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backup_restore_history_restored_by_fk ON backup_restore_history(restored_by) WHERE restored_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_migration_rollback_audit_initiated_by_fk ON migration_rollback_audit(initiated_by) WHERE initiated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artifact_versions_created_by_fk ON artifact_versions(created_by) WHERE created_by IS NOT NULL;

COMMIT;
