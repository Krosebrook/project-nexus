#!/bin/bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly LOG_LEVEL="${LOG_LEVEL:-info}"
readonly SKIP_SEED="${SKIP_SEED:-false}"
readonly DB_TIMEOUT="${DB_TIMEOUT:-300000}"

log_json() {
  local level="$1"
  local message="$2"
  local metadata="${3:-{}}"
  
  if [[ "$metadata" == "{}" ]]; then
    printf '{"timestamp":"%s","level":"%s","message":"%s"}\n' \
      "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")" \
      "$level" \
      "$message"
  else
    printf '{"timestamp":"%s","level":"%s","message":"%s",%s}\n' \
      "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")" \
      "$level" \
      "$message" \
      "${metadata#\{}"
  fi
}

fail() {
  local message="$1"
  local exit_code="${2:-1}"
  local suggestion="${3:-}"
  
  if [[ -n "$suggestion" ]]; then
    log_json "error" "$message" "\"exitCode\":$exit_code,\"suggestion\":\"$suggestion\""
  else
    log_json "error" "$message" "\"exitCode\":$exit_code"
  fi
  
  exit "$exit_code"
}

check_dependencies() {
  log_json "info" "Checking dependencies"
  
  if ! command -v node &> /dev/null; then
    fail "Node.js is not installed" 127 "Install Node.js 20+ from https://nodejs.org"
  fi
  
  local node_version
  node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  if [[ "$node_version" -lt 20 ]]; then
    fail "Node.js version must be 20 or higher (found: v$node_version)" 1 "Upgrade Node.js to version 20+"
  fi
  
  log_json "info" "Dependencies satisfied" "\"nodeVersion\":\"$(node --version)\""
}

wait_for_database() {
  log_json "info" "Waiting for database to be ready" "\"timeout\":$DB_TIMEOUT"
  
  cd "$BACKEND_DIR"
  
  if ! node --import tsx infra/db/wait_for_pg.ts; then
    fail "Database readiness check failed" 2 "Ensure Encore Postgres is running. Check 'encore daemon' status or restart with 'encore run'"
  fi
  
  log_json "info" "Database is ready"
}

run_migrations() {
  log_json "info" "Running database migrations"
  
  cd "$BACKEND_DIR"
  
  if ! node --import tsx infra/db/run_migrations.ts; then
    fail "Database migration failed" 3 "Check migration files in backend/db/migrations/ for syntax errors. Review logs above for details."
  fi
  
  log_json "info" "Migrations completed successfully"
}

run_seed() {
  if [[ "$SKIP_SEED" == "true" ]]; then
    log_json "info" "Skipping database seed (SKIP_SEED=true)"
    return 0
  fi
  
  log_json "info" "Running database seed"
  
  cd "$BACKEND_DIR"
  
  if ! node --import tsx infra/db/seed.ts; then
    log_json "warn" "Database seed failed (non-fatal)" "\"suggestion\":\"Check backend/infra/db/seed.ts for errors\""
    return 0
  fi
  
  log_json "info" "Database seed completed successfully"
}

main() {
  local start_time
  start_time=$(date +%s)
  
  log_json "info" "Starting database provisioning" "\"skipSeed\":$SKIP_SEED,\"timeout\":$DB_TIMEOUT"
  
  check_dependencies
  wait_for_database
  run_migrations
  run_seed
  
  local end_time duration
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  
  log_json "info" "Database provisioning completed successfully" "\"durationSeconds\":$duration"
  
  exit 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
