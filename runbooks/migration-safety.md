

# Migration Safety Runbook

## Overview

This runbook covers the safe migration framework for Project Nexus, including creating reversible migrations, computing checksums, recovering from dirty state, and production best practices.

## Architecture

### Components

1. **migration_framework.ts** - Node CLI for safe migration execution
2. **schema_migrations** - Tracking table with version, checksum, and dirty flag
3. **JSONL Logging** - Structured logs in `logs/migrations.jsonl`
4. **Up/Down Pattern** - Reversible migrations with `.up.sql` and `.down.sql` files

### Schema Migrations Table

```sql
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum TEXT NOT NULL,
  dirty BOOLEAN NOT NULL DEFAULT FALSE
);
```

**Columns:**
- `version` - Unique migration identifier (e.g., "0001_create_users")
- `applied_at` - Timestamp when migration was applied
- `checksum` - SHA256 hash of migration file content
- `dirty` - Flag indicating incomplete/failed migration

## Quick Start

### Apply All Pending Migrations

```bash
npm run db:migrate:safe
```

### Rollback Last Migration

```bash
npm run db:migrate:safe -- down --steps=1
```

### Rollback Multiple Migrations

```bash
npm run db:migrate:safe -- down --steps=3
```

### Disable Auto-Recovery of Dirty Migrations

```bash
npm run db:migrate:safe -- --no-auto-recover
```

## Creating Reversible Migrations

### Step 1: Create Migration Files

```bash
cd backend/db/migrations
touch 0010_add_products.up.sql
touch 0010_add_products.down.sql
```

### Step 2: Write Forward Migration (up.sql)

```sql
-- 0010_add_products.up.sql
-- Migration: Add products table
-- Version: 0010
-- Description: Creates products table with categories

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Insert default products
INSERT INTO products (name, description, price, stock)
VALUES 
  ('Sample Product', 'Example product', 99.99, 100)
ON CONFLICT DO NOTHING;
```

### Step 3: Write Reverse Migration (down.sql)

```sql
-- 0010_add_products.down.sql
-- Rollback Migration: Remove products table
-- Version: 0010
-- Description: Drops products table and related objects

-- Drop indexes
DROP INDEX IF EXISTS idx_products_price;
DROP INDEX IF EXISTS idx_products_name;

-- Drop table
DROP TABLE IF EXISTS products;
```

### Step 4: Compute Checksum

```bash
sha256sum backend/db/migrations/0010_add_products.up.sql
# Output: a1b2c3d4e5f6... 0010_add_products.up.sql
```

Store checksum in commit message or documentation:
```bash
git add backend/db/migrations/0010_add_products.{up,down}.sql
git commit -m "Add migration 0010: products table (checksum: a1b2c3d4...)"
```

### Step 5: Test Locally

```bash
npm run db:migrate:safe

psql -d encore_db -c "SELECT * FROM products;"

npm run db:migrate:safe -- down --steps=1

psql -d encore_db -c "SELECT * FROM products;"

npm run db:migrate:safe
```

### Step 6: Deploy to Production

See "Production Deployment" section below.

## Computing Checksums

### Automatic Checksum

The framework automatically computes SHA256 checksums. No manual action required.

### Manual Verification

Verify checksum matches database:

```bash
sha256sum backend/db/migrations/0010_add_products.up.sql

psql -d encore_db -c "
  SELECT version, checksum 
  FROM schema_migrations 
  WHERE version = '0010_add_products';
"
```

### Re-compute All Checksums

```bash
for file in backend/db/migrations/*.up.sql; do
  echo "$(sha256sum "$file")"
done
```

## Recovering from Dirty State

### Detection

The framework automatically detects dirty migrations on startup:

```json
{"level":"warn","message":"Found migrations in dirty state","versions":["0010_add_products"]}
```

### Automatic Recovery (Default)

By default, the framework attempts automatic recovery:

1. Finds corresponding `.down.sql` file
2. Runs down migration in transaction
3. Removes migration from `schema_migrations`
4. Proceeds with normal migration run

```bash
npm run db:migrate:safe
```

### Manual Recovery

If auto-recovery fails:

#### Option 1: Manual Rollback via Framework

```bash
npm run db:migrate:safe -- down --steps=1
```

#### Option 2: Direct Database Cleanup

```sql
-- Step 1: Inspect dirty migration
SELECT version, applied_at, checksum, dirty 
FROM schema_migrations 
WHERE dirty = TRUE;

-- Step 2: Manually reverse changes (if needed)
-- Review the migration file and manually undo changes

-- Step 3: Clear dirty flag
UPDATE schema_migrations 
SET dirty = FALSE 
WHERE version = '0010_add_products';

-- OR delete the migration record entirely
DELETE FROM schema_migrations 
WHERE version = '0010_add_products';
```

#### Option 3: Manual Down Migration

```bash
psql -d encore_db -f backend/db/migrations/0010_add_products.down.sql

psql -d encore_db -c "
  DELETE FROM schema_migrations 
  WHERE version = '0010_add_products';
"
```

### Prevention

Dirty state occurs when:
1. Migration SQL has errors (syntax, constraint violations)
2. Database connection lost mid-migration
3. Process killed during migration

**Prevent by:**
- Testing migrations locally first
- Using idempotent SQL (`IF NOT EXISTS`, `IF EXISTS`)
- Avoiding long-running migrations (split into smaller chunks)
- Running migrations during low-traffic windows

## Troubleshooting

### Issue: Checksum Mismatch

**Symptoms:**
```json
{"level":"error","message":"Migration 0010_add_products checksum mismatch"}
```

**Cause:** Migration file was modified after being applied

**Fix:**

```bash
git log backend/db/migrations/0010_add_products.up.sql

git show <commit>:backend/db/migrations/0010_add_products.up.sql > /tmp/original.sql

sha256sum /tmp/original.sql

psql -d encore_db -c "
  SELECT checksum 
  FROM schema_migrations 
  WHERE version = '0010_add_products';
"
```

If checksums match original, revert file:
```bash
git checkout <commit> -- backend/db/migrations/0010_add_products.up.sql
```

If file should be updated, create new migration instead:
```bash
touch backend/db/migrations/0011_update_products.up.sql
touch backend/db/migrations/0011_update_products.down.sql
```

**Prevention:** Never modify applied migrations. Always create new migrations.

---

### Issue: Migration Fails Mid-Execution

**Symptoms:**
```json
{"level":"error","message":"Migration failed and was rolled back","version":"0010_add_products"}
```

**Cause:** SQL error, constraint violation, or syntax error

**Fix:**

1. Check logs:
   ```bash
   tail -f logs/migrations.jsonl | grep '"version":"0010_add_products"'
   ```

2. Review error message in logs

3. Fix SQL in migration file

4. Checksum will be different, so must delete failed record:
   ```sql
   DELETE FROM schema_migrations WHERE version = '0010_add_products';
   ```

5. Re-run:
   ```bash
   npm run db:migrate:safe
   ```

**Prevention:** Test migrations in development environment first

---

### Issue: Dirty Migration Cannot Be Recovered

**Symptoms:**
```json
{"level":"error","message":"No down migration found for dirty migration","version":"0010_add_products"}
```

**Cause:** `.down.sql` file missing or incomplete

**Fix:**

1. Create down migration if missing:
   ```bash
   touch backend/db/migrations/0010_add_products.down.sql
   ```

2. Write SQL to reverse changes

3. Run rollback:
   ```bash
   npm run db:migrate:safe -- down --steps=1
   ```

4. Or manually clean up and clear dirty flag:
   ```sql
   -- Manually reverse migration changes
   DROP TABLE IF EXISTS products;
   
   -- Clear dirty flag
   DELETE FROM schema_migrations WHERE version = '0010_add_products';
   ```

**Prevention:** Always create both `.up.sql` and `.down.sql` files together

---

### Issue: Migrations Run Out of Order

**Symptoms:** Migration "0012" runs before "0011"

**Cause:** Incorrect version numbering or timestamp collision

**Fix:**

1. Check migration filenames:
   ```bash
   ls -1 backend/db/migrations/*.up.sql | sort
   ```

2. Rename if needed:
   ```bash
   mv backend/db/migrations/0012_feature.up.sql \
      backend/db/migrations/0013_feature.up.sql
   ```

3. Update checksum in database if already applied:
   ```sql
   UPDATE schema_migrations 
   SET version = '0013_feature' 
   WHERE version = '0012_feature';
   ```

**Prevention:** Use 4-digit zero-padded version numbers (0001, 0002, ..., 0099, 0100)

---

### Issue: Cannot Roll Back Data Migration

**Symptoms:** Down migration cannot restore deleted/modified data

**Cause:** Data migrations are often not reversible

**Fix:**

**Option A: Archive before deleting**
```sql
-- up.sql
CREATE TABLE users_archive AS SELECT * FROM users WHERE status = 'inactive';
DELETE FROM users WHERE status = 'inactive';

-- down.sql
INSERT INTO users SELECT * FROM users_archive;
DROP TABLE users_archive;
```

**Option B: Soft delete instead of hard delete**
```sql
-- up.sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
UPDATE users SET deleted_at = NOW() WHERE status = 'inactive';

-- down.sql
UPDATE users SET deleted_at = NULL WHERE deleted_at IS NOT NULL;
```

**Option C: Accept data loss on rollback**
```sql
-- down.sql
-- WARNING: Rolling back this migration will result in data loss
-- Users with status='inactive' will be permanently deleted
ALTER TABLE users DROP COLUMN IF EXISTS inactive_reason;
```

**Prevention:** Plan data migrations carefully; use backups for critical data

---

### Issue: Concurrent Migrations Running

**Symptoms:**
```
duplicate key value violates unique constraint "schema_migrations_pkey"
```

**Cause:** Multiple migration processes running simultaneously

**Fix:**

1. Ensure only one process runs migrations:
   ```bash
   ps aux | grep migration_framework
   kill <pid>
   ```

2. Use advisory locks for distributed systems:
   ```sql
   SELECT pg_advisory_lock(123456789);
   -- run migrations
   SELECT pg_advisory_unlock(123456789);
   ```

3. In CI/CD, serialize migration jobs:
   ```yaml
   # .github/workflows/deploy.yml
   migrate:
     runs-on: ubuntu-latest
     concurrency:
       group: migrations
       cancel-in-progress: false
   ```

**Prevention:** Coordinate migrations in CI/CD pipelines; use database locks

---

### Issue: Empty Migration File

**Symptoms:**
```json
{"level":"error","message":"Migration 0010_add_products is empty"}
```

**Cause:** Migration file contains only whitespace/comments

**Fix:**

Add SQL statements to migration file:
```sql
-- This is now valid
SELECT 1;
```

Or delete empty migration:
```bash
rm backend/db/migrations/0010_add_products.{up,down}.sql
```

**Prevention:** Always test migrations before committing

---

### Issue: Log File Permission Denied

**Symptoms:**
```
Failed to write to migration log file: EACCES
```

**Cause:** Insufficient permissions on `logs/migrations.jsonl`

**Fix:**

```bash
mkdir -p logs
chmod 755 logs
touch logs/migrations.jsonl
chmod 644 logs/migrations.jsonl
```

**Prevention:** Ensure logs directory is writable; add to `.gitignore`

## Production Deployment

### Pre-Deployment Checklist

- [ ] Migrations tested locally
- [ ] Migrations tested in staging environment
- [ ] Down migrations created and tested
- [ ] Checksums computed and documented
- [ ] Database backup created
- [ ] Rollback plan documented
- [ ] Deployment window scheduled (low traffic)
- [ ] Team notified of deployment

### Deployment Steps

#### 1. Create Backup

```bash
pg_dump encore_db > backups/pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

Or use built-in backup endpoint:
```bash
curl -X POST https://api.example.com/backups/create
```

#### 2. Apply Migrations

```bash
npm run db:migrate:safe 2>&1 | tee logs/migration_$(date +%Y%m%d_%H%M%S).log
```

#### 3. Verify Success

```bash
echo $?

tail -n 20 logs/migrations.jsonl | jq 'select(.level == "error")'

psql -d encore_db -c "
  SELECT version, dirty 
  FROM schema_migrations 
  ORDER BY version DESC 
  LIMIT 10;
"
```

#### 4. Run Smoke Tests

```bash
npm test -- smoke

curl https://api.example.com/health
```

#### 5. Monitor for Issues

Watch application logs and metrics for 15-30 minutes after deployment.

### Rollback Procedure

If issues detected:

#### Automatic Rollback (Recommended)

```bash
npm run db:migrate:safe -- down --steps=1

npm test

npm run db:migrate:safe -- down --steps=2
```

#### Manual Rollback (Emergency)

```bash
psql encore_db < backups/pre_migration_20241030_120000.sql

psql -d encore_db -c "
  SELECT version 
  FROM schema_migrations 
  ORDER BY version DESC;
"
```

#### Partial Rollback

If migration partially succeeded:

```bash
psql -d encore_db -c "
  SELECT version, dirty 
  FROM schema_migrations 
  WHERE dirty = TRUE;
"

npm run db:migrate:safe -- down --steps=1

psql -d encore_db -c "
  DELETE FROM schema_migrations 
  WHERE version = '0010_add_products';
"
```

## Monitoring & Observability

### Check Migration Status

```sql
SELECT 
  version,
  applied_at,
  CASE WHEN dirty THEN '⚠️  DIRTY' ELSE '✓ Clean' END as status,
  LEFT(checksum, 16) || '...' as checksum_preview
FROM schema_migrations
ORDER BY version DESC
LIMIT 10;
```

### View Recent Migrations

```bash
tail -100 logs/migrations.jsonl | jq 'select(.level == "info" and .message == "Migration applied successfully")'
```

### Find Failed Migrations

```bash
tail -1000 logs/migrations.jsonl | jq 'select(.level == "error")'
```

### Check for Dirty Migrations

```sql
SELECT version, applied_at 
FROM schema_migrations 
WHERE dirty = TRUE;
```

### View Migration Performance

```bash
grep "Migration applied successfully" logs/migrations.jsonl | \
  jq -r '"\(.timestamp) \(.version)"' | \
  tail -20
```

## Best Practices

### 1. Always Create Both Up and Down Migrations

```bash
touch backend/db/migrations/0010_feature.up.sql
touch backend/db/migrations/0010_feature.down.sql
```

### 2. Use Idempotent SQL

```sql
CREATE TABLE IF NOT EXISTS ...
DROP TABLE IF EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
```

### 3. Test Rollbacks Locally

```bash
npm run db:migrate:safe
npm run db:migrate:safe -- down --steps=1
npm run db:migrate:safe
```

### 4. Keep Migrations Small

One logical change per migration:
- ✅ 0010_add_products_table.sql
- ✅ 0011_add_products_indexes.sql
- ❌ 0010_add_products_and_orders_and_shipping.sql

### 5. Document Complex Migrations

```sql
-- Migration: Normalize user addresses
-- Version: 0015
-- Description: Splits address column into separate table
-- Impact: ~50,000 rows migrated, estimated 30 seconds
-- Rollback Impact: Addresses concatenated back to single column
-- Data Loss: None (data preserved in both directions)
```

### 6. Avoid Dangerous Operations

Avoid in production:
- `DROP DATABASE`
- `TRUNCATE` (use `DELETE` instead for reversibility)
- Unqualified `DELETE FROM` without `WHERE`

Use with caution:
- `DROP TABLE` (ensure down migration restores data)
- `ALTER TABLE ... DROP COLUMN` (data loss)

### 7. Backup Before Major Migrations

```bash
pg_dump encore_db > backups/before_migration_0020.sql
npm run db:migrate:safe
```

### 8. Schedule During Low Traffic

Run migrations during:
- Off-peak hours
- Maintenance windows
- With read replicas if possible

### 9. Use Transactions for Everything

The framework handles this automatically. Each migration runs in a transaction:
```sql
BEGIN;
-- migration SQL
-- update schema_migrations
COMMIT;
-- OR ROLLBACK on error
```

### 10. Version Control Everything

```bash
git add backend/db/migrations/
git commit -m "Add migration 0010: products table

Checksum: a1b2c3d4e5f6...
Tested: Yes
Rollback tested: Yes"
```

## Security

### Secret Redaction

The framework automatically redacts secrets in logs:

```json
{"password":"[REDACTED]","token":"[REDACTED]","connectionString":"[REDACTED]"}
```

Redacted keys:
- password
- secret
- token
- key
- connectionString
- DATABASE_URL

### Sensitive Migrations

For migrations with sensitive data:

1. **Do not log sensitive values:**
   ```sql
   -- Bad
   INSERT INTO users (email) VALUES ('secret@example.com');
   
   -- Good (parameterized via application code)
   -- Or use separate, restricted migration script
   ```

2. **Restrict log access:**
   ```bash
   chmod 600 logs/migrations.jsonl
   ```

3. **Use environment-specific migrations:**
   ```bash
   # Only in production
   if [ "$NODE_ENV" = "production" ]; then
     npm run db:migrate:safe
   fi
   ```

## Appendix

### CLI Options

```bash
npm run db:migrate:safe

npm run db:migrate:safe -- down

npm run db:migrate:safe -- down --steps=3

npm run db:migrate:safe -- --no-auto-recover
```

### Exit Codes

- `0` - Success
- `1` - Migration failed (see logs for details)

### Log Format

```json
{
  "timestamp": "2025-10-30T10:15:30.123Z",
  "level": "info",
  "message": "Migration applied successfully",
  "version": "0010_add_products",
  "type": "up",
  "checksum": "a1b2c3d4e5f6..."
}
```

### Schema Migrations Table Schema

```sql
\d schema_migrations

           Table "public.schema_migrations"
   Column   |           Type           | Nullable | Default
------------+--------------------------+----------+---------
 version    | text                     | not null |
 applied_at | timestamp with time zone | not null | now()
 checksum   | text                     | not null |
 dirty      | boolean                  | not null | false

Indexes:
    "schema_migrations_pkey" PRIMARY KEY, btree (version)
```

### Migration File Naming Pattern

```
{version}_{description}.{direction}.sql

version:     4-digit zero-padded number (0001, 0002, ...)
description: lowercase_with_underscores
direction:   up | down

Examples:
  0001_create_users.up.sql
  0001_create_users.down.sql
  0010_add_products.up.sql
  0010_add_products.down.sql
```

### Checksum Algorithm

SHA256 hex digest of file content:

```javascript
const crypto = require("crypto");
const fs = require("fs");
const content = fs.readFileSync("migration.sql", "utf-8");
const checksum = crypto.createHash("sha256").update(content).digest("hex");
```

### Related Documentation

- `runbooks/db-provisioning.md` - Database provisioning and readiness checks
- `backend/db/migrations/templates/README.md` - Migration template examples
- `backend/db/migration_framework.ts` - Framework source code
