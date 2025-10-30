-- Rollback Migration: Drop example users table
-- Version: 0001
-- Description: Reverses the 0001_example.up.sql migration

-- Drop trigger first
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes (they will be dropped with the table, but explicit is better)
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_email;

-- Drop the users table
DROP TABLE IF EXISTS users;
