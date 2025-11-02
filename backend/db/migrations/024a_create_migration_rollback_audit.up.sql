-- Optional: Create migration_rollback_audit table
-- Purpose: Support migration auditing and rollback tracking
-- Run this BEFORE v25a if you need the audit table in your schema

BEGIN;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.migration_rollback_audit (
  id BIGSERIAL PRIMARY KEY,
  initiated_by TEXT NULL,
  migration_version INT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('APPLY', 'ROLLBACK')),
  reason TEXT NULL,
  sql_executed TEXT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_migration_rollback_audit_version
  ON public.migration_rollback_audit(migration_version);

CREATE INDEX IF NOT EXISTS idx_migration_rollback_audit_action
  ON public.migration_rollback_audit(action);

CREATE INDEX IF NOT EXISTS idx_migration_rollback_audit_created_at
  ON public.migration_rollback_audit(created_at DESC);

-- Add comment
COMMENT ON TABLE public.migration_rollback_audit IS
  'Audit log for database migrations and rollbacks';

COMMENT ON COLUMN public.migration_rollback_audit.initiated_by IS
  'User ID who initiated the migration/rollback (references users.user_id)';

COMMENT ON COLUMN public.migration_rollback_audit.migration_version IS
  'Migration version number being applied or rolled back';

COMMENT ON COLUMN public.migration_rollback_audit.action IS
  'Type of action: APPLY or ROLLBACK';

COMMENT ON COLUMN public.migration_rollback_audit.reason IS
  'Reason for rollback (null for normal migrations)';

COMMENT ON COLUMN public.migration_rollback_audit.sql_executed IS
  'SQL statements executed (optional, for audit trail)';

COMMENT ON COLUMN public.migration_rollback_audit.succeeded IS
  'Whether the migration/rollback completed successfully';

COMMENT ON COLUMN public.migration_rollback_audit.error_message IS
  'Error message if succeeded=false';

COMMIT;

-- Log creation
DO $$
BEGIN
  RAISE NOTICE 'Created migration_rollback_audit table with indexes';
  RAISE NOTICE 'FK to users.user_id will be added by migration v25a';
END $$;
