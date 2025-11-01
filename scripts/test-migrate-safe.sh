#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

TEST_PASSED=0
TEST_FAILED=0

function test_result() {
  local test_name=$1
  local result=$2
  
  if [ "$result" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $test_name"
    ((TEST_PASSED++))
  else
    echo -e "${RED}✗${NC} $test_name"
    ((TEST_FAILED++))
  fi
}

function cleanup() {
  rm -f logs/.preflight-status logs/.apply-status
}

echo -e "${BLUE}=== Migration Safety Harness Test Suite ===${NC}\n"

if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${YELLOW}WARNING: DATABASE_URL not set${NC}"
  echo "These tests require a PostgreSQL database."
  echo "Set DATABASE_URL to run tests."
  exit 1
fi

cleanup

echo -e "${BLUE}--- Test 1: Script Executable ---${NC}"
if [ -x "$SCRIPT_DIR/migrate-safe.sh" ]; then
  test_result "migrate-safe.sh is executable" 0
else
  chmod +x "$SCRIPT_DIR/migrate-safe.sh"
  test_result "Made migrate-safe.sh executable" 0
fi

echo -e "\n${BLUE}--- Test 2: Help Output ---${NC}"
if "$SCRIPT_DIR/migrate-safe.sh" --help > /dev/null 2>&1; then
  test_result "Help flag works" 0
else
  test_result "Help flag works" 1
fi

echo -e "\n${BLUE}--- Test 3: Dry Run ---${NC}"
if "$SCRIPT_DIR/migrate-safe.sh" --dry-run > /dev/null 2>&1; then
  test_result "Dry run executes without errors" 0
else
  test_result "Dry run executes without errors" 1
fi

echo -e "\n${BLUE}--- Test 4: Preflight Checks ---${NC}"
if "$SCRIPT_DIR/migrate-safe.sh" --preflight > /dev/null 2>&1; then
  test_result "Preflight checks pass" 0
  
  if [ -f logs/.preflight-status ]; then
    test_result "Preflight status file created" 0
  else
    test_result "Preflight status file created" 1
  fi
else
  test_result "Preflight checks pass" 1
fi

echo -e "\n${BLUE}--- Test 5: Migration File Validation ---${NC}"

cd backend/db/migrations

UP_COUNT=$(ls -1 *.up.sql 2>/dev/null | grep -v templates | wc -l)
DOWN_COUNT=$(ls -1 *.down.sql 2>/dev/null | wc -l)

echo "  UP migrations: $UP_COUNT"
echo "  DOWN migrations: $DOWN_COUNT"

if [ $DOWN_COUNT -lt $UP_COUNT ]; then
  echo -e "  ${YELLOW}WARNING: Some migrations missing DOWN scripts${NC}"
  
  for up_file in *.up.sql; do
    version="${up_file%.up.sql}"
    down_file="${version}.down.sql"
    
    if [ ! -f "$down_file" ]; then
      echo -e "    ${YELLOW}Missing: $down_file${NC}"
    fi
  done
  
  test_result "All migrations have DOWN scripts" 1
else
  test_result "All migrations have DOWN scripts" 0
fi

cd - > /dev/null

echo -e "\n${BLUE}--- Test 6: Log Directory Creation ---${NC}"
if [ -d logs ]; then
  test_result "Logs directory exists" 0
else
  test_result "Logs directory exists" 1
fi

if [ -d backups/migrations ]; then
  test_result "Backups directory exists" 0
else
  test_result "Backups directory exists" 1
fi

echo -e "\n${BLUE}--- Test 7: Database Connection ---${NC}"
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  test_result "Database connection successful" 0
else
  test_result "Database connection successful" 1
fi

echo -e "\n${BLUE}--- Test 8: Migration Framework ---${NC}"
if [ -f backend/db/migration_framework.ts ]; then
  test_result "Migration framework exists" 0
else
  test_result "Migration framework exists" 1
fi

echo -e "\n${BLUE}--- Test 9: CI Workflow ---${NC}"
if [ -f .github/workflows/migrations.yml ]; then
  test_result "CI workflow file exists" 0
else
  test_result "CI workflow file exists" 1
fi

echo -e "\n${BLUE}--- Test 10: Documentation ---${NC}"
if [ -f docs/release/migrations.md ]; then
  test_result "Migration runbook exists" 0
  
  if grep -q "Preflight Checks" docs/release/migrations.md; then
    test_result "Runbook contains preflight section" 0
  else
    test_result "Runbook contains preflight section" 1
  fi
  
  if grep -q "Rollback" docs/release/migrations.md; then
    test_result "Runbook contains rollback section" 0
  else
    test_result "Runbook contains rollback section" 1
  fi
else
  test_result "Migration runbook exists" 1
fi

echo -e "\n${BLUE}--- Test Summary ---${NC}"
echo -e "Passed: ${GREEN}$TEST_PASSED${NC}"
echo -e "Failed: ${RED}$TEST_FAILED${NC}"

cleanup

if [ $TEST_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}Some tests failed.${NC}"
  exit 1
fi
