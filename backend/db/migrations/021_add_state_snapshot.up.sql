-- Add state_snapshot column to deployment_logs for resumable deployments
-- This migration is idempotent and safe to re-run

DO $$
BEGIN
  -- Add state_snapshot column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='deployment_logs' AND column_name='state_snapshot'
  ) THEN
    ALTER TABLE deployment_logs
      ADD COLUMN state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- Add index for querying deployments by stage in state_snapshot
CREATE INDEX IF NOT EXISTS idx_deployment_logs_state_snapshot_stage 
  ON deployment_logs((state_snapshot->>'stage'));

COMMENT ON COLUMN deployment_logs.state_snapshot IS 
  'Structured state data for resumable deployments. Contains stage, status, and metadata.';
