# Migration Templates

This directory contains example migration patterns demonstrating the reversible migration framework.

## Template Structure

Each migration consists of two files:
- `{version}_{description}.up.sql` - Forward migration (applies changes)
- `{version}_{description}.down.sql` - Rollback migration (reverses changes)

## Version Naming Convention

Use a 4-digit zero-padded version number followed by a descriptive name:
- `0001_create_users.up.sql` / `0001_create_users.down.sql`
- `0002_add_user_roles.up.sql` / `0002_add_user_roles.down.sql`
- `0003_add_audit_logs.up.sql` / `0003_add_audit_logs.down.sql`

## Best Practices

### 1. Always Create Reversible Migrations

Every `.up.sql` must have a corresponding `.down.sql` that reverses its changes:

**Good:**
```sql
-- up.sql
CREATE TABLE products (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL);

-- down.sql
DROP TABLE IF EXISTS products;
```

**Bad (no down migration):**
```sql
-- Only up.sql, no corresponding down.sql
```

### 2. Use Idempotent Operations

Both up and down migrations should be idempotent (safe to run multiple times):

**Good:**
```sql
CREATE TABLE IF NOT EXISTS products (...);
DROP TABLE IF EXISTS products;
```

**Bad:**
```sql
CREATE TABLE products (...);  -- Fails if table exists
DROP TABLE products;          -- Fails if table doesn't exist
```

### 3. Order Matters for Rollbacks

In down migrations, reverse the order of operations:

**up.sql:**
```sql
CREATE TABLE users (...);
CREATE INDEX idx_users_email ON users(email);
ALTER TABLE users ADD CONSTRAINT ...;
```

**down.sql:**
```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS ...;
DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;
```

### 4. Handle Data Migrations Carefully

When migrating data, consider what happens on rollback:

**up.sql:**
```sql
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
UPDATE users SET status = 'active' WHERE status IS NULL;
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```

**down.sql:**
```sql
ALTER TABLE users DROP COLUMN IF EXISTS status;
-- Note: Column data is lost on rollback - this is expected
```

### 5. Avoid Destructive Operations Without Backups

For migrations that drop columns or tables with data:

**Option A: Two-step migration**
```sql
-- 0001_deprecate_old_column.up.sql
ALTER TABLE users RENAME COLUMN old_name TO old_name_deprecated;

-- 0002_remove_deprecated_column.up.sql (run after verification)
ALTER TABLE users DROP COLUMN IF EXISTS old_name_deprecated;
```

**Option B: Archive before dropping**
```sql
-- up.sql
CREATE TABLE users_archive AS SELECT * FROM users;
DROP TABLE users;

-- down.sql
CREATE TABLE users AS SELECT * FROM users_archive;
DROP TABLE users_archive;
```

### 6. Test Migrations Locally

Before applying to production:

1. Apply migration: `npm run db:migrate:safe`
2. Verify changes: Check tables, data, constraints
3. Test rollback: `npm run db:migrate:safe -- down --steps=1`
4. Verify rollback: Ensure original state restored
5. Re-apply: `npm run db:migrate:safe`

### 7. Include Comments

Document complex migrations:

```sql
-- Migration: Normalize user addresses
-- Version: 0005
-- Description: Splits addresses into separate table for 1:N relationship
-- Impact: Existing address column data migrated to new table
-- Rollback: Addresses de-normalized back to single column (data preserved)

CREATE TABLE addresses (...);
-- ... migration logic ...
```

## Examples in This Directory

### 0001_example - Basic Table Creation
- Creates a `users` table with indexes and triggers
- Demonstrates proper rollback of triggers, indexes, and tables
- Shows safe data insertion with `ON CONFLICT DO NOTHING`

### 0002_add_user_roles - Foreign Keys and Relationships
- Creates role-based access control tables
- Demonstrates junction tables with composite primary keys
- Shows how to assign default values during migration
- Properly handles CASCADE deletions on rollback

## Common Patterns

### Adding a Column
```sql
-- up.sql
ALTER TABLE users ADD COLUMN phone TEXT;

-- down.sql
ALTER TABLE users DROP COLUMN IF EXISTS phone;
```

### Adding a NOT NULL Column with Default
```sql
-- up.sql
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE users ALTER COLUMN status SET NOT NULL;

-- down.sql
ALTER TABLE users DROP COLUMN IF EXISTS status;
```

### Creating an Index
```sql
-- up.sql
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- down.sql
DROP INDEX IF EXISTS idx_users_created_at;
```

### Adding a Foreign Key
```sql
-- up.sql
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- down.sql
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_user_id;
```

### Renaming a Column (Data Preserving)
```sql
-- up.sql
ALTER TABLE users RENAME COLUMN name TO full_name;

-- down.sql
ALTER TABLE users RENAME COLUMN full_name TO name;
```

### Data Migration
```sql
-- up.sql
UPDATE users SET status = 'verified' WHERE email_verified = true;

-- down.sql
-- Note: Cannot fully reverse data changes without audit log
-- Consider using a backup table for critical data migrations
UPDATE users SET email_verified = (status = 'verified');
```

## Migration Workflow

1. **Create migration files:**
   ```bash
   touch backend/db/migrations/0003_my_feature.up.sql
   touch backend/db/migrations/0003_my_feature.down.sql
   ```

2. **Write SQL for both up and down:**
   - Start with `.up.sql` (what you want to achieve)
   - Write `.down.sql` (how to reverse it)
   - Test both locally

3. **Calculate checksum:**
   ```bash
   sha256sum backend/db/migrations/0003_my_feature.up.sql
   ```

4. **Run migration:**
   ```bash
   npm run db:migrate:safe
   ```

5. **Test rollback:**
   ```bash
   npm run db:migrate:safe -- down --steps=1
   ```

6. **Re-apply for verification:**
   ```bash
   npm run db:migrate:safe
   ```

7. **Commit both files together:**
   ```bash
   git add backend/db/migrations/0003_my_feature.{up,down}.sql
   git commit -m "Add migration: my feature"
   ```

## Troubleshooting

See `runbooks/migration-safety.md` for:
- Recovering from dirty state
- Manual checksum verification
- Emergency rollback procedures
- Production migration best practices
