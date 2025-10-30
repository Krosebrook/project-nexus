-- Rollback Migration: Remove user roles and permissions
-- Version: 0002
-- Description: Reverses the 0002_add_user_roles.up.sql migration

-- Drop indexes
DROP INDEX IF EXISTS idx_user_roles_role_id;
DROP INDEX IF EXISTS idx_user_roles_user_id;

-- Drop junction table
DROP TABLE IF EXISTS user_roles;

-- Drop roles table
DROP TABLE IF EXISTS roles;
