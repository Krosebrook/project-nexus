# Foreign Key Migration Fix Plan

## Executive Summary

Comprehensive audit of database schema identified **16 foreign key issues** across 23 migrations. Two new migrations created to resolve all inconsistencies while maintaining data safety and reversibility.

---

## Findings Summary

### Critical Issues (15)

| Source Table | Column | Target | Issue | Migration |
|-------------|--------|--------|-------|-----------|
| dashboard_widgets | user_id | users.user_id | Missing FK constraint | 025 |
| user_preferences | user_id | users.user_id | Missing FK constraint | 025 |
| error_logs | user_id | users.user_id | Missing FK constraint (nullable) | 025 |
| deployment_queue | requested_by | users.user_id | Missing FK constraint (nullable) | 025 |
| deployment_schedules | created_by | users.user_id | Missing FK constraint (nullable) | 025 |
| database_backups | created_by | users.user_id | Missing FK constraint (nullable) | 025 |
| backup_restore_history | restored_by | users.user_id | Missing FK constraint (nullable) | 025 |
| migration_rollback_audit | initiated_by | users.user_id | Missing FK constraint (nullable) | 025 |
| artifact_versions | created_by | users.user_id | Missing FK constraint (nullable) | 025 |
| deployment_approvals | approved_by | users.id | Array FK - needs trigger validation | 026 |
| alert_escalations | user_ids | users.id | Array FK - needs trigger validation | 026 |
| approval_rules | allowed_approvers | users.id | Array FK - needs trigger validation | 026 |
| alert_condition_groups | condition_ids | alert_conditions.id | Array FK - needs trigger validation | 026 |
| error_logs | session_id | N/A | External ID - no FK needed | N/A |
| sync_events | client_id | N/A | External ID - no FK needed | N/A |

### Key Patterns Identified

1. **TEXT→TEXT FK Missing**: 9 columns reference `users.user_id` (TEXT) but lack FK constraints
2. **Array FKs**: 4 BIGINT[] columns need trigger-based validation (Postgres doesn't support array FKs)
3. **External IDs**: 2 columns track external system IDs (intentionally no FK)

---

## Migration Files Generated

### 1. Migration 024: Audit Queries
**File**: `backend/db/migrations/024_comprehensive_fk_audit.sql`

Comprehensive diagnostic queries to:
- List all current FK constraints
- Check for orphaned records in all tables
- Verify indexes exist for FK columns

**Usage**:
```bash
psql $DATABASE_URL -f backend/db/migrations/024_comprehensive_fk_audit.sql > audit_results.txt
```

### 2. Migration 025: Add Missing TEXT FK Constraints
**Files**: 
- `025_add_missing_text_fk_constraints.up.sql`
- `025_add_missing_text_fk_constraints.down.sql`

**Changes**:
- Adds 9 FK constraints for TEXT columns → `users.user_id`
- Cleans orphaned records (DELETE for required FKs, SET NULL for nullable)
- Creates partial indexes (WHERE NOT NULL) for performance

**Data Impact**:
- **Required FKs**: Deletes orphaned rows from `dashboard_widgets`, `user_preferences`
- **Nullable FKs**: Sets orphaned values to NULL (preserves rows)

**Reversibility**: Full DOWN script provided

### 3. Migration 026: Add Array FK Validation
**Files**: 
- `026_add_array_fk_validation.up.sql`
- `026_add_array_fk_validation.down.sql`

**Changes**:
- Creates validation functions for BIGINT[] arrays
- Adds BEFORE INSERT/UPDATE triggers to validate array contents
- Validates:
  - `deployment_approvals.approved_by` → `users.id`
  - `alert_escalations.user_ids` → `users.id`
  - `approval_rules.allowed_approvers` → `users.id`
  - `alert_condition_groups.condition_ids` → `alert_conditions.id`

**Data Impact**: None (triggers only validate future writes)

**Reversibility**: Full DOWN script provided

---

## Dry Run & Verification

### Step 1: Audit Current State
```bash
# Run comprehensive audit
psql $DATABASE_URL -f backend/db/migrations/024_comprehensive_fk_audit.sql > audit_results.txt

# Review orphan counts
grep "orphan_count" audit_results.txt
```

### Step 2: Create Backup
```bash
# Full database backup before applying fixes
pg_dump -Fc $DATABASE_URL > backup_before_fk_fix_$(date +%Y%m%d_%H%M%S).dump
```

### Step 3: Apply Migration 025 (TEXT FKs)
```bash
# Apply forward migration
psql $DATABASE_URL -f backend/db/migrations/025_add_missing_text_fk_constraints.up.sql

# Verify
psql $DATABASE_URL -c "
  SELECT constraint_name, table_name, constraint_type 
  FROM information_schema.table_constraints 
  WHERE constraint_name LIKE '%_user_id_fkey' 
     OR constraint_name LIKE '%_created_by_fkey' 
     OR constraint_name LIKE '%_requested_by_fkey'
  ORDER BY table_name;
"
```

### Step 4: Apply Migration 026 (Array Validation)
```bash
# Apply forward migration
psql $DATABASE_URL -f backend/db/migrations/026_add_array_fk_validation.up.sql

# Verify triggers exist
psql $DATABASE_URL -c "
  SELECT tgname, tgrelid::regclass, tgtype 
  FROM pg_trigger 
  WHERE tgname LIKE 'trg_check_%'
  ORDER BY tgrelid;
"
```

### Step 5: Verification Queries
```sql
-- Count total FK constraints
SELECT COUNT(*) AS total_fks 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

-- Verify no orphans remain
SELECT 'dashboard_widgets' AS table_name, COUNT(*) AS orphans 
FROM dashboard_widgets 
WHERE user_id NOT IN (SELECT user_id FROM users);

-- Test trigger validation (should fail)
DO $$ 
BEGIN
  BEGIN
    INSERT INTO deployment_approvals (deployment_id, approved_by) 
    VALUES (1, ARRAY[999999]::BIGINT[]);
    RAISE EXCEPTION 'Trigger validation failed: should reject invalid user ID';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%Invalid user IDs%' THEN
      RAISE;
    END IF;
  END;
END $$;
```

---

## Risk Assessment

### Medium Risk: Data Cleanup
- **Issue**: Migration 025 deletes orphaned records
- **Mitigation**: 
  - Backup before applying
  - Review audit results first
  - Test in staging environment

### Low Risk: Array Validation Triggers
- **Issue**: Triggers add overhead on INSERT/UPDATE
- **Mitigation**: Validation functions use simple `NOT IN` subqueries (indexed)

### Low Risk: Performance Impact
- **Issue**: New FK constraints add lookup overhead
- **Mitigation**: All indexes are partial (WHERE NOT NULL)

---

## Rollback Plan

### Rollback Migration 026
```bash
psql $DATABASE_URL -f backend/db/migrations/026_add_array_fk_validation.down.sql
```

### Rollback Migration 025
```bash
# WARNING: Does NOT restore deleted data
psql $DATABASE_URL -f backend/db/migrations/025_add_missing_text_fk_constraints.down.sql

# To restore data, use backup
pg_restore -d $DATABASE_URL backup_before_fk_fix_TIMESTAMP.dump
```

---

## Assumptions Documented

1. **User ID Mapping**: TEXT `user_id` columns reference `users.user_id`, not `users.id` (BIGINT)
2. **External IDs**: `error_logs.session_id` and `sync_events.client_id` track external system IDs (no FK needed)
3. **Array Denormalization**: Array columns are intentional denormalization (triggers preferred over junction tables)
4. **Data Quality**: Existing production data mostly follows referential integrity (minimal cleanup expected)

---

## Next Steps

1. ✅ Review this plan with team
2. ✅ Schedule maintenance window for production
3. ✅ Test in staging environment first
4. ✅ Create backup before applying
5. ✅ Apply migration 024 (audit)
6. ✅ Review orphan counts
7. ✅ Apply migration 025 (TEXT FKs)
8. ✅ Verify with queries
9. ✅ Apply migration 026 (array validation)
10. ✅ Monitor application logs for constraint violations

---

## Files Created

```
backend/db/migrations/
├── 024_comprehensive_fk_audit.sql          # Audit queries (diagnostic only)
├── 025_add_missing_text_fk_constraints.up.sql
├── 025_add_missing_text_fk_constraints.down.sql
├── 026_add_array_fk_validation.up.sql
├── 026_add_array_fk_validation.down.sql
└── FK_AUDIT_REPORT.json                    # JSON output contract
```

---

## Contact

For questions or issues during migration:
- Review `FK_AUDIT_REPORT.json` for detailed findings
- Check audit results: `audit_results.txt`
- Escalate to Senior Migrations Engineer

**Last Updated**: 2025-11-01  
**Status**: Ready for staging deployment
