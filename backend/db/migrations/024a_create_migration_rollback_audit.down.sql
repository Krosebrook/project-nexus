-- Rollback: Drop migration_rollback_audit table
-- Purpose: Remove audit table if migration is rolled back

BEGIN;

-- Drop table and all dependent objects
DROP TABLE IF EXISTS public.migration_rollback_audit CASCADE;

COMMIT;

-- Log removal
DO $$
BEGIN
  RAISE NOTICE 'Dropped migration_rollback_audit table and all dependent objects';
END $$;
