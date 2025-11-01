# Migration Safety Runbook

## Overview

This runbook describes the safe migration workflow for database schema changes using the `migrate-safe.sh` safety harness.

## Safety Guarantees

- **No production writes without explicit `--apply` flag**
- **Automatic backups before migrations**
- **Preflight validation prevents risky deployments**
- **Postflight validation ensures schema integrity**
- **Documented rollback path with automated testing**

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Preflight   │─────▶│    Apply     │─────▶│ Postflight   │
│   Checks     │      │  Migrations  │      │  Validation  │
└──────────────┘      └──────────────┘      └──────────────┘
       │                     │                      │
       ▼                     ▼                      ▼
 Schema Diff          Logical Backup          FK Validation
 Lock Check           Migration Exec          Checksum Verify
 Long Txn Detect      Dirty Recovery          Dirty Check
```

## Quick Start

### Standard Migration Workflow

```bash
# 1. Preview changes (no side effects)
./scripts/migrate-safe.sh --dry-run

# 2. Run preflight checks
./scripts/migrate-safe.sh --preflight

# 3. Apply migrations (creates backup automatically)
./scripts/migrate-safe.sh --apply

# 4. Validate results
./scripts/migrate-safe.sh --postflight
```

### Emergency Rollback

```bash
# Rollback last migration
./scripts/migrate-safe.sh --rollback

# Rollback last N migrations
./scripts/migrate-safe.sh --rollback --steps=3
```

## Command Reference

### Modes

| Mode | Description | Side Effects |
|------|-------------|--------------|
| `--preflight` | Schema diff, lock detection, transaction analysis | Read-only |
| `--apply` | Execute pending migrations | **WRITES TO DB** |
| `--postflight` | Validate schema integrity after migration | Read-only |
| `--rollback` | Revert migrations using down scripts | **WRITES TO DB** |
| `--dry-run` | Preview all actions without execution | None |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--steps=N` | Apply/rollback N migrations | All (apply) / 1 (rollback) |
| `--skip-backup` | Skip automatic backup | false |
| `--force` | Skip preflight checks (DANGEROUS) | false |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Preflight check failed |
| 2 | Migration failed |
| 3 | Postflight validation failed |
| 4 | Rollback failed |
| 5 | Configuration error |

## Preflight Checks

### Schema Diff Analysis

Compares current schema against expected state after pending migrations.

**What it detects:**
- Pending migration count
- Current schema size
- Schema drift

**Output:** `logs/preflight-report-<timestamp>.json`

### Long-Running Transaction Detection

Identifies transactions running longer than 30 seconds.

**Why it matters:**
- Long transactions hold locks
- Can cause migration timeouts
- Indicates potential application issues

**Resolution:**
```sql
-- View long-running transactions
SELECT pid, now() - xact_start AS duration, state, query
FROM pg_stat_activity
WHERE state != 'idle' AND xact_start IS NOT NULL
ORDER BY duration DESC;

-- Terminate if necessary (use with caution)
SELECT pg_terminate_backend(pid);
```

### Blocking Lock Detection

Identifies lock contention that could block migrations.

**Why it matters:**
- DDL operations require exclusive locks
- Blocking locks cause migration failures
- Can indicate deadlock scenarios

**Resolution:**
```sql
-- View blocking locks
SELECT 
  blocked.pid AS blocked_pid,
  blocking.pid AS blocking_pid,
  blocked.query AS blocked_query,
  blocking.query AS blocking_query
FROM pg_locks blocked
JOIN pg_stat_activity blocked_activity ON blocked.pid = blocked_activity.pid
JOIN pg_locks blocking ON blocked.locktype = blocking.locktype
WHERE NOT blocked.granted AND blocking.granted;

-- Terminate blocking session (use with caution)
SELECT pg_terminate_backend(<blocking_pid>);
```

## Backup Strategy

### Logical Backup (Default)

Automatically creates compressed logical backup of all tables in public schema.

**Location:** `backups/migrations/backup-<timestamp>.sql.gz`

**What's backed up:**
- All data in public schema
- Excludes schema definitions (reconstructed from migrations)
- Compressed with gzip

**Restore procedure:**
```bash
# View latest backup location
cat backups/migrations/latest-backup.txt

# Restore from backup
zcat backups/migrations/backup-<timestamp>.sql.gz | psql $DATABASE_URL
```

### Skip Backup (Not Recommended)

Only use in development or when external backup exists:

```bash
./scripts/migrate-safe.sh --apply --skip-backup
```

## Apply Phase

### Migration Execution

Migrations are executed via `backend/db/migration_framework.ts` which provides:

- **Transactional safety:** Each migration in isolated transaction
- **Dirty flag handling:** Automatic detection and recovery
- **Checksum validation:** Prevents modified migration re-execution
- **Detailed logging:** JSON logs to `logs/migrations.jsonl`

### Dirty Migration Recovery

If a migration fails mid-execution, it's marked "dirty":

**Automatic recovery (default):**
```bash
./scripts/migrate-safe.sh --apply
# Automatically rolls back dirty migration using down script
```

**Manual recovery:**
```sql
-- View dirty migrations
SELECT version, applied_at FROM schema_migrations WHERE dirty = true;

-- Manually clean up (after fixing data)
UPDATE schema_migrations SET dirty = false WHERE version = '<version>';

-- Or remove entirely
DELETE FROM schema_migrations WHERE version = '<version>';
```

### Incremental Migrations

Apply migrations one at a time for safety:

```bash
# Apply only next migration
./scripts/migrate-safe.sh --apply --steps=1
./scripts/migrate-safe.sh --postflight

# Verify, then continue
./scripts/migrate-safe.sh --apply --steps=1
./scripts/migrate-safe.sh --postflight
```

## Postflight Validation

### Foreign Key Validation

Ensures all FK constraints are valid and enforced.

**What it checks:**
- Unvalidated FK constraints
- Orphaned records
- Constraint violations

**Example failures:**
```json
{
  "table": "deployment_logs",
  "constraint": "deployment_logs_project_id_fkey",
  "foreign_table": "projects"
}
```

**Resolution:**
```sql
-- Find orphaned records
SELECT dl.* FROM deployment_logs dl
LEFT JOIN projects p ON dl.project_id = p.id
WHERE p.id IS NULL;

-- Fix or remove orphaned records
DELETE FROM deployment_logs WHERE project_id NOT IN (SELECT id FROM projects);

-- Revalidate constraint
ALTER TABLE deployment_logs VALIDATE CONSTRAINT deployment_logs_project_id_fkey;
```

### Schema Checksum

Calculates SHA-256 hash of schema definition.

**Uses:**
- Detect schema drift
- Verify migration completeness
- Compare environments

**Output:** `logs/postflight-report-<timestamp>.json`

```json
{
  "timestamp": "2025-11-01T12:34:56Z",
  "schema_checksum": "a1b2c3d4...",
  "migrations_applied": 26,
  "dirty_migrations": 0,
  "validation_passed": true
}
```

### Dirty Migration Check

Ensures no migrations left in inconsistent state.

**If dirty migrations found:**
1. Review `logs/migrations.jsonl` for error details
2. Manually inspect database state
3. Run rollback or manual cleanup
4. Re-run migration

## Rollback Procedures

### Standard Rollback

Uses down migration scripts to reverse changes:

```bash
# Rollback last migration
./scripts/migrate-safe.sh --rollback

# Rollback multiple migrations
./scripts/migrate-safe.sh --rollback --steps=3
```

### Backup Restore

For catastrophic failures or missing down scripts:

```bash
# 1. Find latest backup
cat backups/migrations/latest-backup.txt

# 2. Drop and recreate schema (DESTRUCTIVE)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Restore schema from migrations up to safe point
cd backend/db
npx tsx migration_framework.ts --steps=<N>

# 4. Restore data from backup
zcat backups/migrations/backup-<timestamp>.sql.gz | psql $DATABASE_URL
```

### Point-in-Time Recovery (PITR)

If database supports WAL archiving:

```bash
# Restore to point before migration
pg_basebackup --target-time='2025-11-01 12:00:00'

# Or use cloud provider tools (RDS, CloudSQL, etc.)
```

## CI/CD Integration

### Automated Testing

The GitHub Actions workflow `.github/workflows/migrations.yml` provides:

- **Ephemeral test databases** for each PR
- **Up + down migration testing**
- **Schema parity validation**
- **Zero-downtime verification**

### Workflow Stages

```yaml
1. Create temporary PostgreSQL database
2. Run all up migrations
3. Validate schema integrity
4. Run all down migrations
5. Verify schema matches initial state
6. Run up migrations again (idempotency test)
7. Cleanup temporary database
```

### Pull Request Checks

Required checks before merge:

- [ ] All migrations have down scripts
- [ ] No dirty migrations after up + down cycle
- [ ] Schema checksums match expected
- [ ] No orphaned FK references
- [ ] Migration execution time < 30s per migration

## Production Deployment

### Pre-Deployment Checklist

- [ ] All migrations tested in staging
- [ ] Preflight checks pass in production
- [ ] Backup window scheduled
- [ ] Rollback plan documented
- [ ] Team notified of maintenance window
- [ ] Monitoring dashboards ready

### Deployment Steps

```bash
# 1. Set maintenance mode (if required)
# Implement application-level maintenance mode

# 2. Dry run to verify
DATABASE_URL=$PROD_DATABASE_URL ./scripts/migrate-safe.sh --dry-run

# 3. Run preflight
DATABASE_URL=$PROD_DATABASE_URL ./scripts/migrate-safe.sh --preflight

# 4. Create backup
DATABASE_URL=$PROD_DATABASE_URL ./scripts/migrate-safe.sh --apply
# (Backup happens automatically)

# 5. Run postflight
DATABASE_URL=$PROD_DATABASE_URL ./scripts/migrate-safe.sh --postflight

# 6. Exit maintenance mode
# Restore application traffic

# 7. Monitor for errors
tail -f logs/migrate-safe-*.log
```

### Post-Deployment Monitoring

Monitor for 24 hours:

```sql
-- Check for errors in application logs
SELECT * FROM error_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Monitor query performance
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check lock contention
SELECT * FROM pg_locks WHERE NOT granted;
```

## Troubleshooting

### Migration Timeout

**Symptom:** Migration hangs or times out

**Causes:**
- Blocking locks
- Large table alterations
- Long-running transactions

**Resolution:**
```bash
# 1. Check for locks
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"

# 2. Terminate blocking sessions
psql $DATABASE_URL -c "SELECT pg_terminate_backend(<pid>);"

# 3. Retry with force flag (skip preflight)
./scripts/migrate-safe.sh --apply --force
```

### Checksum Mismatch

**Symptom:** Preflight reports checksum mismatch

**Causes:**
- Modified migration file after application
- Schema drift from manual changes

**Resolution:**
```bash
# 1. Verify migration file integrity
git diff backend/db/migrations/<version>.up.sql

# 2. If file modified, revert or update checksum
# WARNING: Only do this if you understand the implications

# 3. If manual schema change, create new migration
./scripts/migrate-safe.sh --apply --steps=1
```

### Orphaned FK Records

**Symptom:** Postflight FK validation fails

**Resolution:**
```sql
-- Example for deployment_logs -> projects FK
SELECT dl.id, dl.project_id 
FROM deployment_logs dl
LEFT JOIN projects p ON dl.project_id = p.id
WHERE p.id IS NULL;

-- Option 1: Remove orphaned records
DELETE FROM deployment_logs
WHERE project_id NOT IN (SELECT id FROM projects);

-- Option 2: Create missing parent records (if appropriate)
INSERT INTO projects (id, name, description)
SELECT DISTINCT project_id, 'Recovered Project', 'Auto-created'
FROM deployment_logs
WHERE project_id NOT IN (SELECT id FROM projects);
```

### Rollback Failed

**Symptom:** Down migration fails

**Immediate action:**
```bash
# 1. Check dirty flag
psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE dirty = true;"

# 2. Review error in logs
tail -100 logs/migrate-safe-*.log

# 3. Manual intervention required
# - Inspect database state
# - Write custom rollback SQL
# - Or restore from backup
```

## Best Practices

### Migration Design

1. **Atomic changes:** One logical change per migration
2. **Reversible:** Always provide down migrations
3. **Idempotent:** Safe to run multiple times
4. **Tested:** Test both up and down in CI
5. **Documented:** Comment complex migrations

### Example Migration Pair

**File:** `027_add_user_preferences.up.sql`
```sql
-- Add user preferences table
CREATE TABLE user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

**File:** `027_add_user_preferences.down.sql`
```sql
-- Remove user preferences table
DROP TABLE IF EXISTS user_preferences;
```

### Large Table Alterations

For tables with millions of rows:

```sql
-- BAD: Locks table during entire operation
ALTER TABLE large_table ADD COLUMN new_col TEXT;

-- GOOD: Add column as nullable first, backfill, then add constraint
ALTER TABLE large_table ADD COLUMN new_col TEXT NULL;

-- Backfill in batches (separate migration or script)
UPDATE large_table SET new_col = 'default'
WHERE id >= <start> AND id < <end>;

-- Add constraint after backfill (new migration)
ALTER TABLE large_table ALTER COLUMN new_col SET NOT NULL;
```

### Zero-Downtime Migrations

1. **Add column (nullable):** Deploy code + migration
2. **Backfill data:** Background job
3. **Add constraint:** New migration after backfill
4. **Deploy code using new column:** Code deployment
5. **Remove old column:** Final migration

## Reference

### Files

| Path | Purpose |
|------|---------|
| `scripts/migrate-safe.sh` | Main safety harness script |
| `backend/db/migration_framework.ts` | Migration execution engine |
| `backend/db/migrations/*.up.sql` | Forward migrations |
| `backend/db/migrations/*.down.sql` | Rollback migrations |
| `logs/migrate-safe-*.log` | Execution logs |
| `logs/preflight-report-*.json` | Preflight check results |
| `logs/postflight-report-*.json` | Validation results |
| `logs/migrations.jsonl` | Detailed migration logs |
| `backups/migrations/backup-*.sql.gz` | Logical backups |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |

### Useful Queries

```sql
-- View migration history
SELECT version, applied_at, dirty 
FROM schema_migrations 
ORDER BY version DESC;

-- Find largest tables
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Check constraint status
SELECT conname, contype, convalidated
FROM pg_constraint
WHERE conrelid = 'your_table'::regclass;
```

## Support

For issues or questions:

1. Check logs in `logs/` directory
2. Review error messages in `logs/migrations.jsonl`
3. Consult troubleshooting section above
4. Review migration files for potential issues

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-01 | Initial release |
