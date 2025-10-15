-- Database backups table
CREATE TABLE database_backups (
  id BIGSERIAL PRIMARY KEY,
  backup_name TEXT NOT NULL UNIQUE,
  description TEXT,
  backup_type TEXT NOT NULL DEFAULT 'manual',
  file_size BIGINT,
  backup_data JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ
);

CREATE INDEX idx_backups_created_at ON database_backups(created_at DESC);
CREATE INDEX idx_backups_type ON database_backups(backup_type);
CREATE INDEX idx_backups_created_by ON database_backups(created_by);

-- Backup restore history
CREATE TABLE backup_restore_history (
  id BIGSERIAL PRIMARY KEY,
  backup_id BIGINT NOT NULL REFERENCES database_backups(id) ON DELETE CASCADE,
  restored_by TEXT,
  restore_status TEXT NOT NULL DEFAULT 'pending',
  restore_errors TEXT,
  rows_affected JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restore_history_backup_id ON backup_restore_history(backup_id);
CREATE INDEX idx_restore_history_status ON backup_restore_history(restore_status);