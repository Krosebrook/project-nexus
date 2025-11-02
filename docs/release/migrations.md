# Database Migration Runbook

## Overview

This runbook provides comprehensive procedures for safely managing database migrations in production and development environments using the migration safety harness.

**Script:** `scripts/migrate-safe.sh`  
**Framework:** `backend/db/migration_framework.ts`  
**CI Workflow:** `.github/workflows/migrations.yml`

## Table of Contents

1. [Quick Start](#quick-start)
2. [Migration Workflow](#migration-workflow)
3. [Preflight Procedures](#preflight-procedures)
4. [Backup Strategy](#backup-strategy)
5. [Migration Application](#migration-application)
6. [Postflight Validation](#postflight-validation)
7. [Rollback Procedures](#rollback-procedures)
8. [CI/CD Integration](#cicd-integration)
9. [Production Checklist](#production-checklist)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

---

## Quick Start

### Standard Migration Workflow

```bash
# 1. Preview changes (no side effects)
./scripts/migrate-safe.sh --dry-run

# 2. Run safety checks
./scripts/migrate-safe.sh --preflight

# 3. Apply migrations (creates automatic backup)
./scripts/migrate-safe.sh --apply

# 4. Validate results
./scripts/migrate-safe.sh --postflight
```

### Emergency Rollback

```bash
# Rollback last migration
./scripts/migrate-safe.sh --rollback

# Rollback multiple migrations
./scripts/migrate-safe.sh --rollback --steps=3

# Restore from backup
cat backups/migrations/latest-backup.txt
zcat backups/migrations/backup-<timestamp>.sql.gz | psql $DATABASE_URL
```

---

## Migration Workflow

### Phase 1: Development

#### Create Migration Files

All migrations must have both UP and DOWN scripts for rollback safety.

```bash
# Create new migration pair
MIGRATION_NUM="027"
MIGRATION_NAME="add_user_preferences"

cat > backend/db/migrations/${MIGRATION_NUM}_${MIGRATION_NAME}.up.sql << 'EOF'
-- UP Migration: Add user preferences
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
EOF

cat > backend/db/migrations/${MIGRATION_NUM}_${MIGRATION_NAME}.down.sql << 'EOF'
-- DOWN Migration: Remove user preferences
DROP INDEX IF EXISTS idx_user_preferences_user_id;
DROP TABLE IF EXISTS user_preferences;
EOF
```

#### Test Locally

```bash
# Set local database URL
export DATABASE_URL="postgresql://localhost:5432/nexus_dev"

# Preview changes
./scripts/migrate-safe.sh --dry-run

# Run full cycle
./scripts/migrate-safe.sh --preflight
./scripts/migrate-safe.sh --apply
./scripts/migrate-safe.sh --postflight

# Test rollback
./scripts/migrate-safe.sh --rollback
./scripts/migrate-safe.sh --apply --skip-backup  # Reapply for testing
```

#### Commit Changes

```bash
git add backend/db/migrations/${MIGRATION_NUM}_*
git commit -m "feat: add user preferences table"
git push origin feature/user-preferences
```

### Phase 2: CI Validation

When you create a PR, the CI workflow automatically:

1. **Validates migration files** - Checks for UP/DOWN pairs, dangerous commands
2. **Tests migration cycle** - Creates ephemeral DB, runs UP → DOWN → UP
3. **Verifies schema parity** - Ensures rollback restores original schema
4. **Performance analysis** - Times execution, warns on slow migrations
5. **Posts PR comment** - Summary with logs and recommendations

### Phase 3: Staging Deployment

```bash
# Set staging database URL
export DATABASE_URL="postgresql://staging-host:5432/nexus_staging"

# Full safety workflow
./scripts/migrate-safe.sh --dry-run          # Preview
./scripts/migrate-safe.sh --preflight        # Check safety
./scripts/migrate-safe.sh --apply            # Apply with backup
./scripts/migrate-safe.sh --postflight       # Validate

# Monitor logs
tail -f logs/migrate-safe-*.log
cat logs/postflight-report-*.json | jq '.'
```

### Phase 4: Production Deployment

**See [Production Checklist](#production-checklist) for full procedures.**

---

## Preflight Procedures

Preflight checks ensure safe migration execution by detecting potential issues.

### What Preflight Checks

```bash
./scripts/migrate-safe.sh --preflight
```

#### 1. Schema Diff Analysis

- Dumps current schema structure
- Calculates pending migration count
- Reports schema size and complexity

**Output:**
```
[INFO] Schema diff generated. Pending migrations: 3
[INFO] Current schema size: 45621 bytes
```

#### 2. Long-Running Transaction Detection

Identifies transactions running > 30 seconds that could conflict with migrations.

**Sample Output:**
```json
[
  {
    "pid": 12345,
    "duration_seconds": 120,
    "state": "active",
    "query": "UPDATE large_table SET status = 'processed' WHERE..."
  }
]
```

**Action:** Wait for long transactions to complete or terminate them if safe.

```bash
# Terminate specific PID if safe
psql $DATABASE_URL -c "SELECT pg_terminate_backend(12345);"
```

#### 3. Blocking Lock Detection

Finds lock contention between sessions.

**Sample Output:**
```json
[
  {
    "blocked_pid": 23456,
    "blocking_pid": 12345,
    "blocked_query": "ALTER TABLE users ADD COLUMN...",
    "blocking_query": "SELECT * FROM users WHERE...",
    "lock_type": "relation",
    "duration_seconds": 45
  }
]
```

**Action:** Resolve lock contention before proceeding.

#### 4. Database Health Metrics

```
[INFO] Database size: 2.3 GB
[INFO] Active connections: 12
```

### Preflight Success

```
[SUCCESS] === PREFLIGHT PASSED ===
```

Creates marker file: `logs/.preflight-status`

This marker is required for `--apply` to proceed (unless `--force` is used).

### Preflight Failure

```
[ERROR] === PREFLIGHT FAILED ===
[ERROR] Fix issues above before running --apply
```

**Do not proceed with `--apply` until issues are resolved.**

---

## Backup Strategy

### Automatic Backup

Every `--apply` creates a compressed logical backup before migrations run.

```bash
./scripts/migrate-safe.sh --apply
# [INFO] Creating logical backup of affected schemas...
# [INFO] Backing up tables: users projects deployments ...
# [SUCCESS] Backup created: backups/migrations/backup-20251102-143022.sql.gz (4.2M)
```

### Backup Location

```
backups/migrations/
├── backup-20251102-143022.sql.gz
├── backup-20251101-091544.sql.gz
└── latest-backup.txt  (pointer to most recent)
```

### Skip Backup (Testing Only)

```bash
./scripts/migrate-safe.sh --apply --skip-backup
```

**WARNING:** Only use `--skip-backup` in development. Always backup in production.

### Restore from Backup

#### Quick Restore

```bash
# Find latest backup
LATEST=$(cat backups/migrations/latest-backup.txt)

# Restore (overwrites current data!)
zcat "$LATEST" | psql $DATABASE_URL
```

#### Selective Restore

```bash
# Extract specific tables
zcat backup-20251102-143022.sql.gz | \
  grep -A 1000 'COPY users' | \
  psql $DATABASE_URL
```

### Backup Retention

Recommended retention policy:

- **Development:** 7 days, last 10 backups
- **Staging:** 30 days, last 30 backups  
- **Production:** 90 days, all backups

```bash
# Cleanup old backups (7 days)
find backups/migrations/ -name "backup-*.sql.gz" -mtime +7 -delete
```

---

## Migration Application

### Standard Apply

```bash
./scripts/migrate-safe.sh --apply
```

**Process:**
1. Checks for `.preflight-status` marker (created by `--preflight`)
2. Creates automatic backup
3. Executes migrations via `migration_framework.ts`
4. Logs all operations to `logs/migrate-safe-*.log`
5. Creates `.apply-status` marker for postflight

### Apply Specific Count

```bash
# Apply only next migration
./scripts/migrate-safe.sh --apply --steps=1

# Apply next 3 migrations
./scripts/migrate-safe.sh --apply --steps=3
```

### Force Apply (Danger)

```bash
./scripts/migrate-safe.sh --apply --force
```

**WARNING:** Bypasses preflight checks. Use only in emergencies or development.

### Migration Framework Features

The underlying `migration_framework.ts` provides:

- **Transactional execution** - Each migration in a transaction
- **Dirty state management** - Marks incomplete migrations
- **Auto-recovery** - Attempts rollback of dirty migrations
- **Checksum validation** - Detects modified migration files
- **JSONL logging** - Structured logs in `logs/migrations.jsonl`

### Success Output

```
[INFO] Running migrations via migration framework...
[SUCCESS] === MIGRATIONS APPLIED ===
```

### Failure Handling

```
[ERROR] === MIGRATION FAILED ===
[ERROR] Check logs/migrate-safe-20251102-143022.log for details
```

**Actions:**
1. Review error logs: `cat logs/migrate-safe-*.log`
2. Check migration file syntax
3. Look for dirty migrations: `psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE dirty = true;"`
4. Consider rollback: `./scripts/migrate-safe.sh --rollback`

---

## Postflight Validation

Validates successful migration and schema integrity.

```bash
./scripts/migrate-safe.sh --postflight
```

### Validation Checks

#### 1. Foreign Key Validation

Ensures all FK constraints are valid and no orphaned records exist.

```sql
-- Query used internally
SELECT conrelid::regclass AS table, conname AS constraint
FROM pg_constraint
WHERE contype = 'f' AND NOT convalidated;
```

**Success:**
```
[SUCCESS] All foreign keys validated
```

**Failure:**
```json
[
  {
    "table": "deployment_logs",
    "constraint": "fk_deployment_id",
    "foreign_table": "deployments"
  }
]
```

**Fix:** Add `VALIDATE CONSTRAINT` to migration or fix orphaned data.

#### 2. Schema Checksum

Calculates SHA-256 hash of schema for drift detection.

```
[INFO] Schema checksum: 8f3a2e1b9c4d7e6f5a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f
```

Use for comparing environments:

```bash
# Production checksum
DATABASE_URL=$PROD_DB ./scripts/migrate-safe.sh --postflight 2>&1 | grep checksum

# Staging checksum
DATABASE_URL=$STAGING_DB ./scripts/migrate-safe.sh --postflight 2>&1 | grep checksum
```

#### 3. Migration Status

```
[INFO] Applied migrations: 27
[INFO] Dirty migrations: 0
```

**Dirty migrations > 0:**
```
[WARN] Found dirty migrations - database may be in inconsistent state
```

### Postflight Report

```bash
cat logs/postflight-report-20251102-143045.json
```

```json
{
  "timestamp": "2025-11-02T14:30:45Z",
  "schema_checksum": "8f3a2e1b9c4d7e6f5a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f",
  "migrations_applied": 27,
  "dirty_migrations": 0,
  "validation_passed": true
}
```

---

## Rollback Procedures

### Automatic Rollback (Down Migrations)

```bash
# Rollback last migration
./scripts/migrate-safe.sh --rollback

# Rollback last 3 migrations
./scripts/migrate-safe.sh --rollback --steps=3
```

**Process:**
1. Identifies applied migrations in reverse order
2. Executes corresponding `.down.sql` files
3. Removes entries from `schema_migrations` table
4. Logs all operations

**Success:**
```
[SUCCESS] === ROLLBACK COMPLETED ===
```

### Manual Backup Restore

If down migrations fail or don't exist:

```bash
# Find backup
cat backups/migrations/latest-backup.txt

# Review backup contents
zcat backups/migrations/backup-20251102-143022.sql.gz | less

# Restore (WARNING: overwrites data)
zcat backups/migrations/backup-20251102-143022.sql.gz | psql $DATABASE_URL
```

### Rollback Verification

After rollback, verify schema state:

```bash
# Check applied migrations
psql $DATABASE_URL -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"

# Verify schema checksum
./scripts/migrate-safe.sh --postflight
```

### Partial Rollback Recovery

If rollback fails mid-execution:

```bash
# Check dirty state
psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE dirty = true;"

# Manual cleanup (if safe)
psql $DATABASE_URL << 'EOF'
BEGIN;
-- Run failed down migration manually or fix issue
DELETE FROM schema_migrations WHERE version = '027_add_user_preferences';
COMMIT;
EOF
```

---

## CI/CD Integration

### GitHub Actions Workflow

**File:** `.github/workflows/migrations.yml`

Automatically runs on:
- Pull requests modifying `backend/db/migrations/`
- Manual workflow dispatch

### CI Jobs

#### Job 1: Migration Safety Tests

Creates ephemeral PostgreSQL database and tests complete cycle.

```yaml
steps:
  - Setup PostgreSQL service
  - Apply all UP migrations
  - Capture schema dump
  - Rollback all migrations
  - Re-apply all UP migrations
  - Compare schema dumps (must match)
  - Upload logs as artifacts
```

**Validation:**
- Schema parity after rollback/reapply
- No dirty migrations
- All checksums match
- Idempotency confirmed

#### Job 2: Migration File Validation

```yaml
steps:
  - Check for UP/DOWN migration pairs
  - Detect dangerous SQL (DROP DATABASE, TRUNCATE)
  - Validate naming conventions
  - Ensure sequential numbering
```

#### Job 3: Performance Analysis

```yaml
steps:
  - Time each migration
  - Warn if migration > 5 minutes
  - Analyze complexity (table scans, indexes)
  - Identify potential locking operations
```

### PR Comments

CI posts summary comment:

```markdown
## Migration Safety Check ✅

**Migrations Added:** 1
- 027_add_user_preferences.up.sql
- 027_add_user_preferences.down.sql

**Tests Passed:**
- ✅ Schema parity after rollback
- ✅ No dirty migrations
- ✅ Execution time: 0.45s
- ✅ No dangerous commands

**Artifacts:** [View Logs](https://github.com/.../actions/runs/123456789)
```

### Local CI Simulation

```bash
# Run CI tests locally
docker run -d --name postgres-test -e POSTGRES_PASSWORD=test postgres:15
export DATABASE_URL="postgresql://postgres:test@localhost:5432/test"

./scripts/migrate-safe.sh --preflight
./scripts/migrate-safe.sh --apply
./scripts/migrate-safe.sh --postflight
./scripts/migrate-safe.sh --rollback
./scripts/migrate-safe.sh --apply

docker stop postgres-test && docker rm postgres-test
```

---

## Production Checklist

### Pre-Deployment

- [ ] All migrations have DOWN scripts
- [ ] CI tests passing on PR
- [ ] Tested in staging environment
- [ ] Schema checksum matches staging
- [ ] Reviewed migration for dangerous operations
- [ ] Verified backup strategy configured
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback plan documented
- [ ] Team notified of deployment

### Deployment Steps

```bash
# 1. Set production database
export DATABASE_URL="postgresql://prod-host:5432/nexus_prod"

# 2. Backup current state
./scripts/migrate-safe.sh --dry-run
# Review output carefully

# 3. Run preflight checks
./scripts/migrate-safe.sh --preflight
# Wait for PREFLIGHT PASSED

# 4. Apply migrations (creates backup automatically)
./scripts/migrate-safe.sh --apply
# Monitor logs in real-time

# 5. Validate results
./scripts/migrate-safe.sh --postflight
# Ensure POSTFLIGHT PASSED

# 6. Smoke test application
curl https://api.nexus.prod/health
# Verify critical endpoints
```

### Post-Deployment

- [ ] Postflight validation passed
- [ ] Application smoke tests passed
- [ ] No error spike in logs
- [ ] Schema checksum recorded
- [ ] Backup verified and retained
- [ ] Deployment documented
- [ ] Team notified of success

### Rollback Trigger Criteria

Rollback immediately if:

- Migration execution fails
- Postflight validation fails  
- Application errors spike > 10%
- Critical feature broken
- Data corruption detected

```bash
# Emergency rollback
./scripts/migrate-safe.sh --rollback

# If rollback fails, restore backup
LATEST=$(cat backups/migrations/latest-backup.txt)
zcat "$LATEST" | psql $DATABASE_URL
```

---

## Troubleshooting

### Issue: Preflight checks fail

**Symptom:**
```
[ERROR] === PREFLIGHT FAILED ===
```

**Solutions:**

1. **Long-running transactions:**
   ```bash
   # List long transactions
   psql $DATABASE_URL -c "
     SELECT pid, now() - xact_start AS duration, state, query
     FROM pg_stat_activity
     WHERE xact_start IS NOT NULL
     ORDER BY duration DESC;
   "
   
   # Terminate if safe
   psql $DATABASE_URL -c "SELECT pg_terminate_backend(<pid>);"
   ```

2. **Blocking locks:**
   ```bash
   # Find blocking sessions
   psql $DATABASE_URL -f - << 'EOF'
   SELECT 
     blocked.pid AS blocked_pid,
     blocking.pid AS blocking_pid,
     blocked.query AS blocked_query
   FROM pg_locks blocked
   JOIN pg_stat_activity blocked_activity ON blocked.pid = blocked_activity.pid
   JOIN pg_locks blocking ON blocked.locktype = blocking.locktype
   WHERE NOT blocked.granted AND blocking.granted;
   EOF
   ```

### Issue: Migration fails mid-execution

**Symptom:**
```
[ERROR] Migration failed and was rolled back
```

**Solutions:**

1. **Check dirty migrations:**
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE dirty = true;"
   ```

2. **Review error logs:**
   ```bash
   cat logs/migrate-safe-*.log | grep ERROR
   tail -100 logs/migrations.jsonl | jq 'select(.level == "error")'
   ```

3. **Fix and retry:**
   ```bash
   # Fix migration file syntax
   vim backend/db/migrations/027_*.up.sql
   
   # Retry
   ./scripts/migrate-safe.sh --apply
   ```

### Issue: Dirty migration won't recover

**Symptom:**
```
[ERROR] Failed to recover dirty migration
```

**Solutions:**

1. **Manual down migration:**
   ```bash
   psql $DATABASE_URL -f backend/db/migrations/027_add_user_preferences.down.sql
   psql $DATABASE_URL -c "DELETE FROM schema_migrations WHERE version = '027_add_user_preferences';"
   ```

2. **Restore from backup:**
   ```bash
   LATEST=$(cat backups/migrations/latest-backup.txt)
   zcat "$LATEST" | psql $DATABASE_URL
   ```

### Issue: Postflight validation fails

**Symptom:**
```
[ERROR] === POSTFLIGHT FAILED ===
```

**Solutions:**

1. **Unvalidated foreign keys:**
   ```bash
   psql $DATABASE_URL -c "
     SELECT conrelid::regclass AS table, conname AS constraint
     FROM pg_constraint
     WHERE contype = 'f' AND NOT convalidated;
   "
   
   # Validate manually
   psql $DATABASE_URL -c "ALTER TABLE <table> VALIDATE CONSTRAINT <constraint>;"
   ```

2. **Dirty migrations:**
   ```bash
   # Use framework auto-recovery
   cd backend/db
   npx tsx migration_framework.ts
   ```

### Issue: Rollback fails

**Symptom:**
```
[ERROR] === ROLLBACK FAILED ===
```

**Solutions:**

1. **Check down migration exists:**
   ```bash
   ls -la backend/db/migrations/*_<version>.down.sql
   ```

2. **Review down migration syntax:**
   ```bash
   cat backend/db/migrations/027_add_user_preferences.down.sql
   ```

3. **Manual rollback:**
   ```bash
   psql $DATABASE_URL -f backend/db/migrations/027_add_user_preferences.down.sql
   psql $DATABASE_URL -c "DELETE FROM schema_migrations WHERE version = '027_add_user_preferences';"
   ```

4. **Restore backup (last resort):**
   ```bash
   LATEST=$(cat backups/migrations/latest-backup.txt)
   zcat "$LATEST" | psql $DATABASE_URL
   ```

### Issue: Missing dependencies

**Symptom:**
```
[ERROR] Missing required dependencies: psql pg_dump
```

**Solutions:**

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql-client-15
```

**macOS:**
```bash
brew install postgresql@15
```

**Verify:**
```bash
psql --version
pg_dump --version
```

---

## Best Practices

### Migration Design

#### ✅ DO

- **Always create DOWN migrations** for rollback safety
- **Use transactions** (default in framework)
- **Add NOT NULL with DEFAULT** to avoid table rewrites:
  ```sql
  ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  ```
- **Create indexes CONCURRENTLY** to avoid locks:
  ```sql
  CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
  ```
- **Use CHECK constraints** for data validation:
  ```sql
  ALTER TABLE users ADD CONSTRAINT check_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$');
  ```
- **Test migrations locally** before committing
- **Keep migrations small** and focused (one concern per migration)

#### ❌ DON'T

- **Don't use DROP DATABASE** (blocked by script)
- **Don't use TRUNCATE** without careful consideration
- **Don't add NOT NULL without DEFAULT** on large tables
- **Don't create regular indexes** on large tables (use CONCURRENTLY)
- **Don't modify applied migrations** (checksum will fail)
- **Don't combine schema + data migrations** (separate them)
- **Don't skip rollback testing**

### Migration Naming

**Format:** `NNN_descriptive_name.{up|down}.sql`

**Good:**
- `027_add_user_preferences.up.sql`
- `028_add_index_deployments_created_at.up.sql`
- `029_add_rbac_permissions.up.sql`

**Bad:**
- `migration.sql` (not numbered, no direction)
- `update.up.sql` (not descriptive)
- `27.sql` (no zero padding, no name)

### Dangerous Operations

These operations require extra caution:

#### Column Drops

```sql
-- BAD: Immediate drop (downtime if app still using)
ALTER TABLE users DROP COLUMN deprecated_field;

-- GOOD: Two-phase approach
-- Migration 1: Stop using in app
-- Migration 2 (later): Drop column
```

#### Table Renames

```sql
-- BAD: Rename (breaks old app)
ALTER TABLE user RENAME TO users;

-- GOOD: Multi-phase approach
-- Phase 1: Create new table, sync data
-- Phase 2: Switch app to new table
-- Phase 3: Drop old table
```

#### Large Data Migrations

```sql
-- BAD: Update all rows in one migration (locks table)
UPDATE users SET migrated = true;

-- GOOD: Batch update or background job
-- See: backend/db/migrations/002_seed_data.up.sql for examples
```

### Testing Strategy

```bash
# 1. Test in development
export DATABASE_URL="postgresql://localhost:5432/nexus_dev"
./scripts/migrate-safe.sh --dry-run
./scripts/migrate-safe.sh --preflight
./scripts/migrate-safe.sh --apply
./scripts/migrate-safe.sh --postflight

# 2. Test rollback
./scripts/migrate-safe.sh --rollback
./scripts/migrate-safe.sh --apply  # Reapply

# 3. Test idempotency
./scripts/migrate-safe.sh --rollback
./scripts/migrate-safe.sh --apply
./scripts/migrate-safe.sh --postflight  # Checksum should match

# 4. Push and verify CI passes
git push origin feature/migration
# Check CI results

# 5. Test in staging
export DATABASE_URL="$STAGING_DB"
./scripts/migrate-safe.sh --preflight
./scripts/migrate-safe.sh --apply
./scripts/migrate-safe.sh --postflight
```

### Monitoring

```bash
# Real-time migration monitoring
tail -f logs/migrate-safe-*.log

# Structured logs
tail -f logs/migrations.jsonl | jq 'select(.level == "error" or .level == "warn")'

# Database monitoring during migration
watch -n 1 'psql $DATABASE_URL -c "
  SELECT 
    state,
    COUNT(*) 
  FROM pg_stat_activity 
  GROUP BY state;
"'

# Lock monitoring
watch -n 1 'psql $DATABASE_URL -c "
  SELECT 
    locktype,
    mode,
    COUNT(*) 
  FROM pg_locks 
  GROUP BY locktype, mode;
"'
```

---

## Examples

### Example 1: Add New Table

```sql
-- 030_add_audit_log.up.sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

```sql
-- 030_add_audit_log.down.sql
DROP INDEX IF EXISTS idx_audit_log_created_at;
DROP INDEX IF EXISTS idx_audit_log_entity;
DROP INDEX IF EXISTS idx_audit_log_user_id;
DROP TABLE IF EXISTS audit_log;
```

### Example 2: Add Column with Backfill

```sql
-- 031_add_user_timezone.up.sql

-- Add column with default
ALTER TABLE users 
ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';

-- Backfill from existing data (if needed)
UPDATE users 
SET timezone = COALESCE(preferences->>'timezone', 'UTC')
WHERE preferences IS NOT NULL;

-- Add constraint
ALTER TABLE users 
ADD CONSTRAINT check_timezone 
CHECK (timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$');
```

```sql
-- 031_add_user_timezone.down.sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_timezone;
ALTER TABLE users DROP COLUMN IF EXISTS timezone;
```

### Example 3: Add Index Concurrently

```sql
-- 032_add_deployments_index.up.sql

-- CONCURRENTLY prevents table locks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deployments_status_created_at 
ON deployments(status, created_at DESC);
```

```sql
-- 032_add_deployments_index.down.sql

-- CONCURRENTLY also for drops
DROP INDEX CONCURRENTLY IF EXISTS idx_deployments_status_created_at;
```

### Example 4: Modify Constraint

```sql
-- 033_update_project_name_length.up.sql

-- Drop old constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_project_name_length;

-- Add new constraint (max 255 instead of 100)
ALTER TABLE projects 
ADD CONSTRAINT check_project_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 255);
```

```sql
-- 033_update_project_name_length.down.sql

-- Restore old constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_project_name_length;

ALTER TABLE projects 
ADD CONSTRAINT check_project_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 100);
```

---

## Reference

### Script Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--preflight` | Run safety checks | `./scripts/migrate-safe.sh --preflight` |
| `--apply` | Apply migrations | `./scripts/migrate-safe.sh --apply` |
| `--postflight` | Validate results | `./scripts/migrate-safe.sh --postflight` |
| `--rollback` | Revert migrations | `./scripts/migrate-safe.sh --rollback` |
| `--dry-run` | Preview changes | `./scripts/migrate-safe.sh --dry-run` |
| `--steps=N` | Limit count | `./scripts/migrate-safe.sh --apply --steps=1` |
| `--skip-backup` | Skip backup | `./scripts/migrate-safe.sh --apply --skip-backup` |
| `--force` | Skip preflight | `./scripts/migrate-safe.sh --apply --force` |

### Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Continue |
| 1 | Preflight failed | Fix issues, retry |
| 2 | Migration failed | Check logs, rollback |
| 3 | Postflight failed | Validate manually |
| 4 | Rollback failed | Manual intervention |
| 5 | Config error | Check environment |

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |

### Log Files

| File | Purpose | Format |
|------|---------|--------|
| `logs/migrate-safe-<timestamp>.log` | Main execution log | Text + JSON |
| `logs/preflight-report-<timestamp>.json` | Preflight results | JSON |
| `logs/postflight-report-<timestamp>.json` | Validation results | JSON |
| `logs/migrations.jsonl` | Detailed migration events | JSONL |
| `backups/migrations/latest-backup.txt` | Latest backup pointer | Text |

### Related Files

| File | Purpose |
|------|---------|
| `scripts/migrate-safe.sh` | Main migration script |
| `backend/db/migration_framework.ts` | Migration execution engine |
| `backend/db/schema-preflight.ts` | Schema validation |
| `.github/workflows/migrations.yml` | CI testing workflow |
| `scripts/test-migrate-safe.sh` | Script test suite |

---

## Support

For issues or questions:

1. Review this runbook
2. Check `logs/migrate-safe-*.log` for errors
3. Consult [Troubleshooting](#troubleshooting) section
4. Review migration framework code: `backend/db/migration_framework.ts`
5. Check CI logs for automated test failures

---

**Last Updated:** 2025-11-02  
**Version:** 1.0  
**Maintainer:** Release Engineering Team
