-- Deployment durability improvements

-- Ensure fast lookup by id (status index already exists from migration 005)
CREATE INDEX IF NOT EXISTS idx_deployment_logs_id ON deployment_logs(id);

-- Auto-update updated_at trigger (Postgres)
CREATE OR REPLACE FUNCTION touch_updated_at() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply trigger to deployment_logs table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_deployment_logs_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_deployment_logs_touch_updated_at
    BEFORE UPDATE ON deployment_logs
    FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();
  END IF;
END $$;
