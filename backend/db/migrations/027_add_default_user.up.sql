-- Add default user to support user_preferences foreign key constraint
-- This migration is idempotent and safe to run multiple times

BEGIN;

-- Insert default user if it doesn't exist
INSERT INTO users (user_id, email, name, role, is_active)
VALUES ('default', 'default@system.local', 'Default User', 'developer', true)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
