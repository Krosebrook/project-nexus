-- Rollback: Remove foreign key constraints added in migration 025

BEGIN;

ALTER TABLE dashboard_widgets DROP CONSTRAINT IF EXISTS dashboard_widgets_user_id_fkey;
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
ALTER TABLE error_logs DROP CONSTRAINT IF EXISTS error_logs_user_id_fkey;
ALTER TABLE deployment_queue DROP CONSTRAINT IF EXISTS deployment_queue_requested_by_fkey;
ALTER TABLE deployment_schedules DROP CONSTRAINT IF EXISTS deployment_schedules_created_by_fkey;
ALTER TABLE database_backups DROP CONSTRAINT IF EXISTS database_backups_created_by_fkey;
ALTER TABLE backup_restore_history DROP CONSTRAINT IF EXISTS backup_restore_history_restored_by_fkey;
ALTER TABLE migration_rollback_audit DROP CONSTRAINT IF EXISTS migration_rollback_audit_initiated_by_fkey;
ALTER TABLE artifact_versions DROP CONSTRAINT IF EXISTS artifact_versions_created_by_fkey;

DROP INDEX IF EXISTS idx_error_logs_user_id_fk;
DROP INDEX IF EXISTS idx_deployment_queue_requested_by_fk;
DROP INDEX IF EXISTS idx_deployment_schedules_created_by_fk;
DROP INDEX IF EXISTS idx_database_backups_created_by_fk;
DROP INDEX IF EXISTS idx_backup_restore_history_restored_by_fk;
DROP INDEX IF EXISTS idx_migration_rollback_audit_initiated_by_fk;
DROP INDEX IF EXISTS idx_artifact_versions_created_by_fk;

COMMIT;
