ALTER TABLE provisioned_databases ADD COLUMN IF NOT EXISTS supabase_project_ref TEXT;
ALTER TABLE provisioned_databases ADD COLUMN IF NOT EXISTS supabase_organization_id TEXT;
ALTER TABLE provisioned_databases RENAME COLUMN database_name TO database;

CREATE INDEX IF NOT EXISTS idx_provisioned_databases_supabase_project_ref ON provisioned_databases(supabase_project_ref) WHERE supabase_project_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_provisioned_databases_neon_project_id ON provisioned_databases(neon_project_id) WHERE neon_project_id IS NOT NULL;
