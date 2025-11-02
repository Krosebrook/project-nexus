-- Remove default user
-- This is the rollback for adding the default user

BEGIN;

-- Delete the default user
DELETE FROM users WHERE user_id = 'default';

COMMIT;
