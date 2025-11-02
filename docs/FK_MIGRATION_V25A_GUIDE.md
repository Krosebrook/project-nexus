# FK Migration v25a: Hardened Implementation Guide

## Executive Summary

Migration v25 failed in staging due to referencing a non-existent table (`migration_rollback_audit`), causing `SQLSTATE 42P01` and aborting the transaction. This document describes the **hardened, idempotent, reversible v25a migration** that safely adds foreign key constraints only when both source and target tables/columns exist.

## Problem Statement

### Root Cause
- **Error**: `relation "migration_rollback_audit" does not exist (SQLSTATE 42P01)`
- **Impact**: Entire transaction aborted; subsequent statements (including `pg_advisory_unlock`) were ignored
- **Pattern**: Migration assumed table/column presence; only checked constraint existence in `pg_constraint`

### Symptoms
```
ERROR: relation "migration_rollback_audit" does not exist
SQLSTATE: 42P01
ERROR: current transaction is aborted, commands ignored until end of transaction block
SQLSTATE: 25P02
```

## Solution Architecture

### Design Principles
1. **Existence Checks**: Verify table AND column existence before any DDL
2. **Idempotent**: Safe to run multiple times; skips existing constraints
3. **Graceful Degradation**: Skip missing tables instead of failing
4. **Data Safety**: Clean orphans before adding FKs (DELETE for required, SET NULL for optional)
5. **Reversible**: Includes down migration for safe rollback

### Strategy Overview
```
For each FK constraint:
  ├─ Check if source table exists
  ├─ Check if source column exists
  ├─ Check if target table exists
  ├─ Check if constraint already exists
  ├─ If all exist and constraint missing:
  │   ├─ Clean orphan data (DELETE or SET NULL)
  │   ├─ Add FK constraint
  │   └─ Create supporting index
  └─ Otherwise: Skip with NOTICE
```

## File Structure

```
backend/db/migrations/
├── 025_add_missing_text_fk_constraints_v2.up.sql     ← Hardened UP migration
└── 025_add_missing_text_fk_constraints_v2.down.sql   ← Rollback migration

scripts/
├── preflight-schema-check.sql                         ← Run before migration
└── post-migration-integrity-check.sql                 ← Run after migration

docs/
└── FK_MIGRATION_V25A_GUIDE.md                         ← This document
```

## Migration Details

### UP Migration (`025_add_missing_text_fk_constraints_v2.up.sql`)

#### Helper Functions

**`table_exists_ci(schema, table)`**
- Case-insensitive table existence check
- Returns: `BOOLEAN`

**`add_fk_if_possible(...)`**
- Parameters:
  - `src_schema`, `src_table`, `src_col`: Source table/column
  - `tgt_table`, `tgt_pk`: Target table/column
  - `fk_name`: Constraint name
  - `on_delete_action`: `'CASCADE'` | `'SET NULL'` | `'NO ACTION'`
  - `is_nullable`: `BOOLEAN` (determines orphan handling)
- Behavior:
  1. Checks existence of source table, source column, target table
  2. Checks if constraint already exists
  3. Skips if any check fails (with NOTICE)
  4. Cleans orphans: DELETE if required FK, SET NULL if nullable
  5. Adds FK constraint
  6. Creates supporting index (partial for nullable columns)

#### FK Constraints Added

| Source Table | Column | Target | Delete Action | Nullable | Index |
|--------------|--------|--------|---------------|----------|-------|
| `dashboard_widgets` | `user_id` | `users.user_id` | CASCADE | ❌ | ✓ |
| `user_preferences` | `user_id` | `users.user_id` | CASCADE | ❌ | ✓ |
| `error_logs` | `user_id` | `users.user_id` | SET NULL | ✓ | ✓ (partial) |
| `deployment_queue` | `requested_by` | `users.user_id` | SET NULL | ✓ | ✓ (partial) |
| `deployment_schedules` | `created_by` | `users.user_id` | SET NULL | ✓ | ✓ (partial) |
| `database_backups` | `created_by` | `users.user_id` | SET NULL | ✓ | ✓ (partial) |
| `backup_restore_history` | `restored_by` | `users.user_id` | SET NULL | ✓ | ✓ (partial) |
| `artifact_versions` | `created_by` | `users.user_id` | SET NULL | ✓ | ✓ (partial) |
| `migration_rollback_audit` | `initiated_by` | `users.user_id` | SET NULL | ✓ | ✓ (partial) |

**Note**: `migration_rollback_audit` FK will be **skipped** if table doesn't exist (prevents the original error).

### DOWN Migration (`025_add_missing_text_fk_constraints_v2.down.sql`)

- Drops all FK constraints added by UP migration
- Drops all supporting indexes
- Idempotent: Uses `DROP CONSTRAINT IF EXISTS` and `DROP INDEX IF EXISTS`
- **Does NOT restore deleted orphan data**

## Operational Procedures

### Pre-Deployment: Preflight Check

**Purpose**: Verify schema readiness and preview data impact

```bash
# Run preflight check
psql $DATABASE_URL -f scripts/preflight-schema-check.sql > preflight-report.txt

# Review report for:
# - Missing tables (will be skipped)
# - Orphan data counts (will be cleaned)
# - Existing constraints (will be skipped)
```

**Key Outputs**:
- Table existence status
- Column existence status
- Orphan record counts
- Migration readiness assessment

### Deployment: Run Migration

```bash
# Standard migration run (via Encore or direct)
encore db migrate up

# OR manual execution
psql $DATABASE_URL -f backend/db/migrations/025_add_missing_text_fk_constraints_v2.up.sql
```

**Expected Output**:
- `NOTICE: Added FK <name> on <table>.<column> → <target>`
- `NOTICE: Skipping FK <name> - <reason>` (for missing tables)
- `WARNING: Deleted N orphan rows...` (if orphans existed)

### Post-Deployment: Integrity Verification

**Purpose**: Confirm FKs applied correctly and no orphans remain

```bash
# Run integrity checks
psql $DATABASE_URL -f scripts/post-migration-integrity-check.sql > integrity-report.txt

# Verify:
# - All expected FKs exist
# - Zero orphan records
# - Indexes created
```

**Success Criteria**:
- All orphan counts = 0
- All expected constraints present
- All FK columns have indexes

### Rollback Procedure

```bash
# If migration needs to be rolled back
psql $DATABASE_URL -f backend/db/migrations/025_add_missing_text_fk_constraints_v2.down.sql

# Verify rollback
psql $DATABASE_URL -c "SELECT conname FROM pg_constraint WHERE conname LIKE '%_user_id_fkey';"
```

**Warning**: Rollback does NOT restore deleted orphan data. Export orphans before migration if restoration is needed.

## Edge Cases & Handling

### 1. `migration_rollback_audit` Table Missing
**Behavior**: FK skipped with NOTICE
**Impact**: No error; migration continues
**Action**: None required (unless table is needed)

### 2. Large Orphan Datasets
**Risk**: Long-running DELETE/UPDATE during migration
**Mitigation**:
```sql
-- Pre-migration: Export orphans for audit
CREATE TABLE orphan_audit_dashboard_widgets AS
SELECT * FROM dashboard_widgets dw
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = dw.user_id);
```

### 3. Constraint Already Exists
**Behavior**: Skipped with NOTICE
**Impact**: Idempotent; safe to re-run

### 4. Partial Schema (Dev/Test Environments)
**Behavior**: Only present tables get FKs
**Impact**: Safe; missing tables skipped gracefully

## Performance Considerations

### Lock Duration
- Each `ALTER TABLE ... ADD CONSTRAINT` acquires **ACCESS EXCLUSIVE** lock
- Duration: ~100ms for small tables, longer for large tables
- **Recommendation**: Run during low-traffic window for production

### Index Creation
- Indexes created within transaction (not concurrent)
- For very large tables (>10M rows), consider:
  ```sql
  -- Split index creation to separate migration
  CREATE INDEX CONCURRENTLY idx_table_column_fk ON table(column);
  ```

### Orphan Cleanup
- `DELETE` scans entire source table
- `SET NULL` updates only non-null orphan rows
- **Estimate runtime**:
  ```sql
  EXPLAIN ANALYZE
  DELETE FROM dashboard_widgets
  WHERE user_id NOT IN (SELECT user_id FROM users);
  ```

## Security & Compliance

### Data Loss
- **Required FKs**: Orphan rows **DELETED**
- **Nullable FKs**: Orphan references **SET TO NULL**
- **Audit Trail**: Enable query logging during migration

### Privilege Requirements
- Standard DDL privileges (`ALTER TABLE`, `CREATE INDEX`)
- No superuser required
- No elevated `pg_catalog` access

### SQL Injection Protection
- All identifiers quoted via `format('%I', ...)`
- No untrusted input in dynamic SQL

## CI/CD Integration

### Pipeline Steps

```yaml
deploy:
  steps:
    - name: Preflight Check
      run: psql $DB_URL -f scripts/preflight-schema-check.sql | tee preflight.log
      
    - name: Verify Readiness
      run: |
        if grep -q "NOT READY" preflight.log; then
          echo "Schema not ready for migration"
          exit 1
        fi
    
    - name: Run Migration
      run: encore db migrate up
    
    - name: Post-Deploy Verification
      run: psql $DB_URL -f scripts/post-migration-integrity-check.sql | tee integrity.log
    
    - name: Assert Zero Orphans
      run: |
        if grep -q "FAIL" integrity.log; then
          echo "Integrity check failed"
          exit 1
        fi
    
    - name: Archive Reports
      uses: actions/upload-artifact@v3
      with:
        name: migration-reports
        path: |
          preflight.log
          integrity.log
```

### Environment-Specific Behavior

| Environment | Expected Behavior |
|-------------|-------------------|
| **Local Dev** | Partial schema OK; some FKs skipped |
| **Staging** | Full schema; all FKs added |
| **Production** | Full schema; verify in low-traffic window |

## Troubleshooting

### Issue: "current transaction is aborted"
**Cause**: Earlier error in transaction
**Solution**: Ensure UP migration is used (has existence checks)

### Issue: "violates foreign key constraint"
**Cause**: Orphan data not cleaned
**Solution**: Re-run migration (it will clean orphans)

### Issue: "constraint already exists"
**Cause**: Migration already applied
**Solution**: Safe to ignore (idempotent)

### Issue: Long lock wait
**Cause**: Large table with concurrent writes
**Solution**: Retry during maintenance window

## Optional: Create `migration_rollback_audit` Table

If the audit table is part of your design but missing in some environments:

```sql
-- Run before v25a migration
CREATE TABLE IF NOT EXISTS public.migration_rollback_audit (
  id BIGSERIAL PRIMARY KEY,
  initiated_by TEXT NULL,
  migration_version INT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('APPLY','ROLLBACK')),
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Then run v25a migration normally
-- The FK will now be added to migration_rollback_audit
```

## Best Practices

1. **Always run preflight check** before production deployments
2. **Archive preflight/integrity reports** as deployment artifacts
3. **Monitor lock duration** in production; set statement timeout if needed
4. **Export orphans** before migration if data restoration might be needed
5. **Document FK policy** (nullable vs required) in schema documentation
6. **Use migration template** for future FK additions

## Migration Template for Future Use

```sql
-- Add new FK using hardened pattern
SELECT add_fk_if_possible(
  'public',                    -- source schema
  'new_table',                 -- source table
  'user_id',                   -- source column
  'users',                     -- target table
  'user_id',                   -- target PK column
  'new_table_user_id_fkey',    -- constraint name
  'CASCADE',                   -- or 'SET NULL'
  false                        -- is_nullable
);
```

## References

- Original failed migration: `025_add_missing_text_fk_constraints.up.sql`
- PostgreSQL docs: [Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- Encore migration guide: `docs/release/migrations.md`

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| v25a | 2025-11-02 | Hardened migration with existence checks |
| v25 | 2025-11-01 | Failed in staging (table missing) |

---

**Status**: ✅ Ready for Deployment  
**Risk Level**: Low (idempotent, graceful degradation, reversible)  
**Testing**: Verified in local dev and staging environments
