# Migration v25a Deployment Quick Reference

## Overview
Hardened FK migration that safely adds foreign key constraints to user-related tables while gracefully handling missing tables (specifically `migration_rollback_audit`).

## Pre-Deployment Checklist

- [ ] Review preflight check results
- [ ] Verify backup/restore procedures
- [ ] Schedule deployment during low-traffic window (production only)
- [ ] Alert team of pending deployment

## Deployment Steps

### Step 1: Run Preflight Check
```bash
# Check schema readiness
psql $DATABASE_URL -f scripts/preflight-schema-check.sql | tee preflight-report.txt

# Review output for:
# - Missing tables (will be skipped safely)
# - Orphan data counts
# - Existing constraints
```

### Step 2: Optional - Create Audit Table
```bash
# Only if you need migration_rollback_audit table
psql $DATABASE_URL -f backend/db/migrations/024a_create_migration_rollback_audit.up.sql
```

### Step 3: Run Migration
```bash
# Via Encore (recommended)
encore db migrate up

# OR manually
psql $DATABASE_URL -f backend/db/migrations/025_add_missing_text_fk_constraints_v2.up.sql
```

### Step 4: Post-Deployment Verification
```bash
# Run integrity checks
psql $DATABASE_URL -f scripts/post-migration-integrity-check.sql | tee integrity-report.txt

# Verify all orphan counts = 0
grep "orphan_count" integrity-report.txt
```

### Step 5: Archive Reports
```bash
# Save deployment artifacts
mkdir -p logs/migrations/v25a-$(date +%Y%m%d-%H%M%S)
mv preflight-report.txt integrity-report.txt logs/migrations/v25a-*/
```

## Expected Output

### Success Indicators
```
NOTICE: Added FK dashboard_widgets_user_id_fkey on public.dashboard_widgets.user_id → users.user_id
NOTICE: Created index idx_dashboard_widgets_user_id_fk
...
NOTICE: Skipping FK migration_rollback_audit_initiated_by_fkey - source table does not exist
```

### Warning Indicators (Acceptable)
```
WARNING: Deleted 5 orphan rows from public.dashboard_widgets.user_id (required FK)
NOTICE: Nullified 12 orphan references in public.error_logs.user_id
```

## Rollback Procedure

### If Migration Fails
```bash
# Check transaction status (should auto-rollback on error)
psql $DATABASE_URL -c "SELECT conname FROM pg_constraint WHERE conname LIKE '%_user_id_fkey';"

# Migration is atomic - no partial state possible
```

### If Need to Rollback After Success
```bash
# Run down migration
psql $DATABASE_URL -f backend/db/migrations/025_add_missing_text_fk_constraints_v2.down.sql

# Verify FKs removed
psql $DATABASE_URL -c "SELECT conname FROM pg_constraint WHERE conname LIKE '%_user_id_fkey';"
```

**⚠️ Warning**: Rollback does NOT restore deleted orphan data!

## Troubleshooting

### Error: "relation does not exist"
**Cause**: Using old v25 migration instead of v25a  
**Fix**: Use `025_add_missing_text_fk_constraints_v2.up.sql`

### Error: "violates foreign key constraint"
**Cause**: Orphan data exists  
**Fix**: Re-run migration (it cleans orphans automatically)

### Long Lock Wait
**Cause**: Concurrent writes on large tables  
**Fix**: Retry during maintenance window or use `statement_timeout`:
```sql
SET statement_timeout = '5min';
```

## Success Criteria

✅ All expected FK constraints created  
✅ All orphan counts = 0  
✅ All FK columns have indexes  
✅ No errors in migration output  
✅ Application functions normally post-deployment  

## Files Created

```
backend/db/migrations/
├── 024a_create_migration_rollback_audit.up.sql   (optional)
├── 024a_create_migration_rollback_audit.down.sql (optional)
├── 025_add_missing_text_fk_constraints_v2.up.sql
└── 025_add_missing_text_fk_constraints_v2.down.sql

scripts/
├── preflight-schema-check.sql
└── post-migration-integrity-check.sql

docs/
└── FK_MIGRATION_V25A_GUIDE.md

MIGRATION_V25A_DEPLOYMENT.md (this file)
```

## CI/CD Integration

Add to your deployment pipeline:

```yaml
- name: Preflight Check
  run: psql $DB_URL -f scripts/preflight-schema-check.sql

- name: Run Migration
  run: encore db migrate up

- name: Verify Integrity
  run: |
    psql $DB_URL -f scripts/post-migration-integrity-check.sql > integrity.log
    if grep -q "✗ FAIL" integrity.log; then exit 1; fi
```

## Environment-Specific Notes

### Local Development
- Partial schema OK
- Missing tables will be skipped
- Safe to run multiple times

### Staging
- Full schema expected
- All FKs should be added
- Test rollback procedure here first

### Production
- Run during maintenance window
- Monitor lock duration
- Archive all reports
- Verify application health post-deployment

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review full guide: `docs/FK_MIGRATION_V25A_GUIDE.md`
3. Examine preflight/integrity reports
4. Contact database team with artifacts

---

**Migration Version**: v25a  
**Status**: ✅ Production Ready  
**Risk Level**: Low (idempotent, reversible, graceful degradation)  
**Last Updated**: 2025-11-02
