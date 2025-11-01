#!/bin/bash
# Foreign Key Migration Verification Script
# Run this after applying migrations 025 and 026 to verify success

set -e

DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable not set"
  exit 1
fi

echo "=================================="
echo "FK Migration Verification Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for pass/fail
PASS=0
FAIL=0

function run_check() {
  local description="$1"
  local query="$2"
  local expected="$3"
  
  echo -n "Checking: $description... "
  
  result=$(psql "$DATABASE_URL" -t -A -c "$query" 2>&1)
  
  if [ "$result" = "$expected" ]; then
    echo -e "${GREEN}PASS${NC}"
    ((PASS++))
  else
    echo -e "${RED}FAIL${NC} (got: $result, expected: $expected)"
    ((FAIL++))
  fi
}

echo "=== 1. Verify FK Constraints Exist ==="
echo ""

run_check "dashboard_widgets.user_id FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'dashboard_widgets_user_id_fkey';" \
  "1"

run_check "user_preferences.user_id FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'user_preferences_user_id_fkey';" \
  "1"

run_check "error_logs.user_id FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'error_logs_user_id_fkey';" \
  "1"

run_check "deployment_queue.requested_by FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'deployment_queue_requested_by_fkey';" \
  "1"

run_check "deployment_schedules.created_by FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'deployment_schedules_created_by_fkey';" \
  "1"

run_check "database_backups.created_by FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'database_backups_created_by_fkey';" \
  "1"

run_check "backup_restore_history.restored_by FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'backup_restore_history_restored_by_fkey';" \
  "1"

run_check "migration_rollback_audit.initiated_by FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'migration_rollback_audit_initiated_by_fkey';" \
  "1"

run_check "artifact_versions.created_by FK" \
  "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'artifact_versions_created_by_fkey';" \
  "1"

echo ""
echo "=== 2. Verify Array Validation Triggers Exist ==="
echo ""

run_check "deployment_approvals trigger" \
  "SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_check_deployment_approvals_approved_by';" \
  "1"

run_check "alert_escalations trigger" \
  "SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_check_alert_escalations_user_ids';" \
  "1"

run_check "approval_rules trigger" \
  "SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_check_approval_rules_allowed_approvers';" \
  "1"

run_check "alert_condition_groups trigger" \
  "SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_check_alert_condition_groups_condition_ids';" \
  "1"

echo ""
echo "=== 3. Verify No Orphaned Records ==="
echo ""

run_check "dashboard_widgets orphans" \
  "SELECT COUNT(*) FROM dashboard_widgets WHERE user_id NOT IN (SELECT user_id FROM users);" \
  "0"

run_check "user_preferences orphans" \
  "SELECT COUNT(*) FROM user_preferences WHERE user_id NOT IN (SELECT user_id FROM users);" \
  "0"

run_check "error_logs orphans" \
  "SELECT COUNT(*) FROM error_logs WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM users);" \
  "0"

echo ""
echo "=== 4. Verify Indexes Created ==="
echo ""

run_check "error_logs.user_id index" \
  "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_error_logs_user_id_fk';" \
  "1"

run_check "deployment_queue.requested_by index" \
  "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_deployment_queue_requested_by_fk';" \
  "1"

run_check "deployment_schedules.created_by index" \
  "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_deployment_schedules_created_by_fk';" \
  "1"

echo ""
echo "=== 5. Test Array Validation (Should Fail Gracefully) ==="
echo ""

# This should fail with a specific error message
echo -n "Testing invalid user ID in array... "
psql "$DATABASE_URL" -c "
  DO \$\$ 
  BEGIN
    BEGIN
      INSERT INTO deployment_approvals (deployment_id, approved_by) 
      VALUES (1, ARRAY[999999999]::BIGINT[]);
      RAISE EXCEPTION 'VALIDATION_FAILED: Trigger did not reject invalid user ID';
    EXCEPTION WHEN others THEN
      IF SQLERRM LIKE '%Invalid user IDs%' THEN
        -- Expected error, validation working
        RAISE NOTICE 'VALIDATION_OK';
      ELSE
        -- Unexpected error
        RAISE;
      END IF;
    END;
  END \$\$;
" 2>&1 | grep -q "VALIDATION_OK" && echo -e "${GREEN}PASS${NC}" && ((PASS++)) || (echo -e "${RED}FAIL${NC}" && ((FAIL++)))

echo ""
echo "=== 6. Verify ON DELETE/UPDATE Rules ==="
echo ""

run_check "CASCADE rules exist" \
  "SELECT COUNT(*) FROM information_schema.referential_constraints WHERE delete_rule = 'CASCADE' AND constraint_schema = 'public' AND constraint_name LIKE '%_user_id_fkey';" \
  "2"

run_check "SET NULL rules exist" \
  "SELECT COUNT(*) FROM information_schema.referential_constraints WHERE delete_rule = 'SET NULL' AND constraint_schema = 'public' AND constraint_name LIKE '%_fkey' AND (constraint_name LIKE '%_created_by_fkey' OR constraint_name LIKE '%_requested_by_fkey' OR constraint_name LIKE '%_restored_by_fkey' OR constraint_name LIKE '%_initiated_by_fkey');" \
  "7"

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo -e "PASSED: ${GREEN}$PASS${NC}"
echo -e "FAILED: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! Migrations applied successfully.${NC}"
  exit 0
else
  echo -e "${RED}✗ Some checks failed. Please review the output above.${NC}"
  exit 1
fi
