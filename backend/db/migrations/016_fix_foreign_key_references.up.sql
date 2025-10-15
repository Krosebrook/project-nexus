-- Fix foreign key references for deployment_logs.rollback_from_deployment_id
-- This migration ensures the foreign key constraint is properly defined

DO $$
BEGIN
  -- Check if the constraint already exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deployment_logs_rollback_from_deployment_id_fkey'
  ) THEN
    -- Verify the column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'deployment_logs' 
      AND column_name = 'rollback_from_deployment_id'
    ) THEN
      -- Add the foreign key constraint
      ALTER TABLE deployment_logs 
        ADD CONSTRAINT deployment_logs_rollback_from_deployment_id_fkey 
        FOREIGN KEY (rollback_from_deployment_id) REFERENCES deployment_logs(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Ensure index exists for better query performance
CREATE INDEX IF NOT EXISTS idx_deployment_logs_rollback_from ON deployment_logs(rollback_from_deployment_id);