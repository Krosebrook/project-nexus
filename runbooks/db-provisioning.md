# Database Provisioning Runbook

## Overview

This runbook covers database provisioning for the Project Nexus application using Encore.ts with built-in PostgreSQL. The provisioning process includes readiness checks, schema migrations, and optional data seeding.

## Architecture

### Components

1. **wait_for_pg.ts** - Database readiness probe with exponential backoff and jitter
2. **run_migrations.ts** - Transactional migration runner with checksum verification
3. **provision-db.sh** - Orchestration script coordinating readiness → migrations → seed
4. **seed.ts** - Optional data seeding for development environments

### Flow

```
provision-db.sh
  ├─> Check Node.js dependencies
  ├─> wait_for_pg.ts (max 5 minutes with exp backoff)
  ├─> run_migrations.ts (transactional, idempotent)
  └─> seed.ts (optional, skippable via SKIP_SEED=true)
```

## Quick Start

### Local Development

```bash
npm ci
npm run db:provision
npm test
```

### CI/CD Pipeline

```bash
npm ci

export DB_TIMEOUT=180000
export SKIP_SEED=true

npm run db:provision

if [ $? -ne 0 ]; then
  echo "Database provisioning failed"
  exit 1
fi

npm test
```

## Usage

### Basic Provisioning

```bash
npm run db:provision
```

### Skip Seeding (Production)

```bash
SKIP_SEED=true npm run db:provision
```

### Custom Timeout

```bash
DB_TIMEOUT=60000 npm run db:provision
```

### Direct Script Execution

```bash
cd backend
bash infra/scripts/provision-db.sh
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_TIMEOUT` | 300000 | Database readiness timeout in milliseconds (5 minutes) |
| `SKIP_SEED` | false | Skip database seeding if set to "true" |
| `LOG_LEVEL` | info | Logging level (debug, info, warn, error) |

## Troubleshooting Matrix

### Exit Codes

| Code | Meaning | Component |
|------|---------|-----------|
| 0 | Success | - |
| 1 | General error | provision-db.sh |
| 2 | Database readiness failure | wait_for_pg.ts |
| 3 | Migration failure | run_migrations.ts |
| 127 | Dependency missing | provision-db.sh |

### Common Issues

#### Issue: Database readiness check fails immediately

**Symptoms:**
```json
{"level":"error","message":"Database readiness check failed","exitCode":2}
```

**Cause:** Encore daemon not running or PostgreSQL not started

**Fix:**
```bash
encore daemon

encore run
```

**Prevention:** Ensure `encore run` is active in another terminal before provisioning

---

#### Issue: Database readiness timeout after 5 minutes

**Symptoms:**
```json
{"level":"error","message":"Postgres readiness timeout after 300000ms"}
```

**Cause:** Database taking too long to start or connectivity issue

**Fix:**
1. Check if Encore daemon is running: `ps aux | grep encore`
2. Restart Encore: `encore daemon --stop && encore daemon`
3. Increase timeout: `DB_TIMEOUT=600000 npm run db:provision`

**Prevention:** Allocate sufficient resources; check Docker/VM memory limits if applicable

---

#### Issue: Migration checksum mismatch

**Symptoms:**
```json
{"level":"error","message":"Migration checksum mismatch","filename":"001_create_schema.up.sql"}
```

**Cause:** Applied migration file was modified after being run

**Fix:**
```bash
psql -d encore_db -c "DELETE FROM schema_migrations WHERE filename='001_create_schema.up.sql';"

git checkout backend/db/migrations/001_create_schema.up.sql

npm run db:provision
```

**Prevention:** NEVER modify applied migration files. Create new migrations instead.

---

#### Issue: Migration SQL syntax error

**Symptoms:**
```json
{"level":"error","message":"Migration failed","filename":"019_add_provisioning.up.sql","error":"syntax error at or near \"CRATE\""}
```

**Cause:** SQL syntax error in migration file

**Fix:**
1. Open the migration file: `backend/db/migrations/019_add_provisioning.up.sql`
2. Fix the SQL syntax error (e.g., `CRATE` → `CREATE`)
3. If migration was partially applied:
   ```bash
   psql -d encore_db -c "DELETE FROM schema_migrations WHERE filename='019_add_provisioning.up.sql';"
   ```
4. Re-run: `npm run db:provision`

**Prevention:** Test migration SQL in a scratch database before committing

---

#### Issue: Node.js version too old

**Symptoms:**
```json
{"level":"error","message":"Node.js version must be 20 or higher (found: v18)","exitCode":127}
```

**Cause:** Node.js version < 20

**Fix:**
```bash
nvm install 20
nvm use 20

npm run db:provision
```

**Prevention:** Use `.nvmrc` file in repository root:
```bash
echo "20" > .nvmrc
nvm use
```

---

#### Issue: Connection refused errors during retry

**Symptoms:**
```json
{"level":"warn","message":"Postgres not ready, retrying with backoff","error":"Connection refused"}
```

**Cause:** Database still starting up (NORMAL during cold start)

**Fix:** Wait for retries to complete. This is expected behavior. If it exceeds timeout, see "Database readiness timeout" above.

**Prevention:** None needed. This is normal operation.

---

#### Issue: Permission denied on provision-db.sh

**Symptoms:**
```bash
bash: ./infra/scripts/provision-db.sh: Permission denied
```

**Cause:** Script not executable

**Fix:**
```bash
chmod +x backend/infra/scripts/provision-db.sh
npm run db:provision
```

**Prevention:** Commit with execute permissions:
```bash
git update-index --chmod=+x backend/infra/scripts/provision-db.sh
```

---

#### Issue: Migration table not created

**Symptoms:**
```json
{"level":"error","error":"relation \"schema_migrations\" does not exist"}
```

**Cause:** Database user lacks CREATE TABLE permissions

**Fix:**
```bash
psql -d encore_db -c "GRANT CREATE ON SCHEMA public TO current_user;"

npm run db:provision
```

**Prevention:** Encore should handle this automatically. Report as bug if persistent.

---

#### Issue: Seed fails in production

**Symptoms:**
```json
{"level":"warn","message":"Database seed failed (non-fatal)"}
```

**Cause:** Seed script designed for development only

**Fix:** Use `SKIP_SEED=true` in production:
```bash
SKIP_SEED=true npm run db:provision
```

**Prevention:** Always set `SKIP_SEED=true` in production CI/CD pipelines

---

#### Issue: Concurrent migration runs cause conflicts

**Symptoms:**
```json
{"level":"error","error":"duplicate key value violates unique constraint \"schema_migrations_filename_key\""}
```

**Cause:** Multiple provisioning processes running simultaneously

**Fix:**
1. Ensure only one provisioning process runs at a time
2. Use database locks if concurrent runs are necessary:
   ```sql
   SELECT pg_advisory_lock(123456);
   ```

**Prevention:** Serialize provisioning in CI/CD pipelines; use flock in scripts

---

## Verification

### Check Migration Status

```bash
psql -d encore_db -c "SELECT filename, applied_at FROM schema_migrations ORDER BY id;"
```

### Verify Database Connectivity

```bash
cd backend
node --import tsx -e "import db from './db/index.js'; db.queryRow\`SELECT 1\`.then(() => console.log('OK'))"
```

### Run Provisioning in Dry-Run Mode

```bash
cd backend
node --import tsx infra/db/wait_for_pg.ts && echo "Readiness: OK"
node --import tsx infra/db/run_migrations.ts && echo "Migrations: OK"
```

## Idempotency Guarantees

### Safe to Re-run

✅ **provision-db.sh** - Safe to run multiple times
✅ **wait_for_pg.ts** - Readiness check has no side effects
✅ **run_migrations.ts** - Skips already-applied migrations via checksum verification
✅ **seed.ts** - Checks for existing data before seeding

### Not Idempotent

❌ Manually running SQL from migration files - Can cause duplicate data or constraint violations

## Monitoring

### Success Indicators

All operations should log JSON with `"level":"info"` and complete with exit code 0:

```json
{"timestamp":"2025-10-30T10:15:30.123Z","level":"info","message":"Database provisioning completed successfully","durationSeconds":12}
```

### Failure Indicators

Errors log JSON with `"level":"error"` and non-zero exit code:

```json
{"timestamp":"2025-10-30T10:15:30.123Z","level":"error","message":"Migration failed","exitCode":3,"suggestion":"Check migration files for syntax errors"}
```

### Metrics to Track

- **Provisioning duration** - Typical: 5-15 seconds (fresh), 1-3 seconds (re-run)
- **Readiness attempts** - Typical: 1-3 attempts
- **Migrations applied** - Should match number of `.up.sql` files
- **Exit code distribution** - 0 = success, >0 = investigate

## Rollback

### Undo Last Migration

Encore.ts does not auto-generate down migrations. Manual rollback:

1. Create rollback SQL manually
2. Run against database
3. Remove from tracking table:
   ```bash
   psql -d encore_db -c "DELETE FROM schema_migrations WHERE filename='019_add_provisioning.up.sql';"
   ```

### Full Reset (Development Only)

```bash
encore db reset

npm run db:provision
```

**⚠️ WARNING:** This destroys all data. Never run in production.

## Security

### Secret Handling

✅ Connection strings are redacted in logs as `[REDACTED]`
✅ No credentials logged or exposed in error messages
✅ Migrations run with least-privilege database user configured by Encore

### Least Privilege

The database user should have:
- `CREATE` on schema for migration table
- `SELECT, INSERT, UPDATE, DELETE` on application tables
- No `SUPERUSER` or `CREATEROLE` permissions

## Performance

### Optimization Tips

1. **Reduce timeout for CI**: `DB_TIMEOUT=60000` if database is usually ready quickly
2. **Skip seed in CI**: `SKIP_SEED=true` saves 1-2 seconds
3. **Parallel CI jobs**: Ensure each job uses isolated database or serialize provisioning

### Benchmarks

- **Cold start (database starting)**: 5-30 seconds
- **Warm start (database ready)**: 1-3 seconds
- **Fresh migration run (19 files)**: 3-8 seconds
- **Idempotent re-run**: 0.5-2 seconds

## Support

### Logs Location

All components log to stdout as JSON lines. Redirect to file:

```bash
npm run db:provision > provision.log 2>&1
```

### Debug Mode

Enable verbose logging:

```bash
LOG_LEVEL=debug npm run db:provision
```

### Reporting Issues

When reporting issues, include:

1. Full JSON logs from provision run
2. Exit code
3. Node.js version: `node --version`
4. Encore version: `encore version`
5. Output of: `psql -d encore_db -c "SELECT version();"`

## Appendix

### Migration File Naming Convention

Format: `{number}_{description}.up.sql`

Examples:
- `001_create_schema.up.sql`
- `002_seed_data.up.sql`
- `019_add_provisioning.up.sql`

### Schema Migrations Table Structure

```sql
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checksum TEXT NOT NULL
);
```

### Exponential Backoff Parameters

- **Base delay**: 1000ms
- **Max delay**: 30000ms (30 seconds)
- **Jitter factor**: 30%
- **Max attempts**: 60
- **Formula**: `min(1000 * 2^attempt, 30000) + (random * 0.3 * delay)`

Example backoff sequence:
- Attempt 1: ~1000ms + jitter
- Attempt 2: ~2000ms + jitter
- Attempt 3: ~4000ms + jitter
- Attempt 4: ~8000ms + jitter
- Attempt 5+: ~30000ms + jitter (capped)
