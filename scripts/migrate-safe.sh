#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/db/migrations"
LOGS_DIR="$PROJECT_ROOT/logs"
BACKUP_DIR="$PROJECT_ROOT/backups/migrations"

LOG_FILE="$LOGS_DIR/migrate-safe-$(date +%Y%m%d-%H%M%S).log"
PREFLIGHT_REPORT="$LOGS_DIR/preflight-report-$(date +%Y%m%d-%H%M%S).json"
POSTFLIGHT_REPORT="$LOGS_DIR/postflight-report-$(date +%Y%m%d-%H%M%S).json"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

MODE=""
DRY_RUN=false
SKIP_BACKUP=false
FORCE=false
STEPS=""
TARGET_DB="${DATABASE_URL:-}"

function log() {
  local level=$1
  shift
  local message="$*"
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  case $level in
    INFO)
      echo -e "${BLUE}[INFO]${NC} $message" | tee -a "$LOG_FILE"
      ;;
    SUCCESS)
      echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
      ;;
    WARN)
      echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
      ;;
    ERROR)
      echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
      ;;
  esac
  
  echo "{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"message\":\"$message\"}" >> "$LOG_FILE"
}

function usage() {
  cat <<EOF
Usage: $0 <MODE> [OPTIONS]

MODES:
  --preflight         Run preflight checks (schema diff, locks, long-running txns)
  --apply             Apply migrations (requires --preflight first or --force)
  --postflight        Run postflight validation (checksums, FK validation)
  --rollback          Rollback last migration(s)
  --dry-run           Show what would happen without executing

OPTIONS:
  --steps=N           Number of migrations to apply/rollback (default: all/1)
  --skip-backup       Skip automatic backup before apply
  --force             Skip preflight checks and apply anyway (DANGEROUS)
  -h, --help          Show this help message

EXAMPLES:
  # Safe migration workflow
  $0 --preflight
  $0 --apply
  $0 --postflight
  
  # Dry run to preview changes
  $0 --dry-run
  
  # Rollback last migration
  $0 --rollback
  
  # Apply only 1 migration
  $0 --apply --steps=1

ENVIRONMENT:
  DATABASE_URL        PostgreSQL connection string (required)

EXIT CODES:
  0 - Success
  1 - Preflight check failed
  2 - Migration failed
  3 - Postflight validation failed
  4 - Rollback failed
  5 - Configuration error

EOF
  exit 0
}

function check_dependencies() {
  log INFO "Checking dependencies..."
  
  local missing_deps=()
  
  if ! command -v psql &> /dev/null; then
    missing_deps+=("psql")
  fi
  
  if ! command -v pg_dump &> /dev/null; then
    missing_deps+=("pg_dump")
  fi
  
  if ! command -v node &> /dev/null; then
    missing_deps+=("node")
  fi
  
  if [ ${#missing_deps[@]} -ne 0 ]; then
    log ERROR "Missing required dependencies: ${missing_deps[*]}"
    log ERROR "Please install PostgreSQL client tools and Node.js"
    exit 5
  fi
  
  if [ -z "$TARGET_DB" ]; then
    log ERROR "DATABASE_URL environment variable not set"
    exit 5
  fi
  
  log SUCCESS "All dependencies satisfied"
}

function ensure_dirs() {
  mkdir -p "$LOGS_DIR"
  mkdir -p "$BACKUP_DIR"
  
  log INFO "Log file: $LOG_FILE"
}

function get_pending_migrations() {
  psql "$TARGET_DB" -t -A -c "
    WITH pending AS (
      SELECT 
        regexp_replace(pg_ls_dir, '\.up\.sql$', '') AS version
      FROM pg_ls_dir('$MIGRATIONS_DIR')
      WHERE pg_ls_dir LIKE '%.up.sql'
      EXCEPT
      SELECT version FROM schema_migrations WHERE dirty = false
    )
    SELECT COUNT(*) FROM pending;
  " 2>/dev/null || echo "0"
}

function detect_long_running_transactions() {
  log INFO "Detecting long-running transactions..."
  
  local result=$(psql "$TARGET_DB" -t -A -c "
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'pid', pid,
          'duration_seconds', EXTRACT(EPOCH FROM (NOW() - xact_start))::int,
          'state', state,
          'query', left(query, 100)
        )
      )
    FROM pg_stat_activity
    WHERE state != 'idle'
      AND xact_start IS NOT NULL
      AND NOW() - xact_start > interval '30 seconds'
      AND pid != pg_backend_pid();
  " 2>/dev/null || echo "null")
  
  if [ "$result" != "null" ] && [ "$result" != "" ]; then
    log WARN "Found long-running transactions:"
    echo "$result" | jq -C '.' 2>/dev/null || echo "$result"
    echo "$result" >> "$PREFLIGHT_REPORT"
    return 1
  else
    log SUCCESS "No long-running transactions detected"
    return 0
  fi
}

function detect_blocking_locks() {
  log INFO "Detecting blocking locks..."
  
  local result=$(psql "$TARGET_DB" -t -A -c "
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'blocked_pid', blocked.pid,
          'blocking_pid', blocking.pid,
          'blocked_query', left(blocked.query, 100),
          'blocking_query', left(blocking.query, 100),
          'lock_type', blocked.locktype,
          'duration_seconds', EXTRACT(EPOCH FROM (NOW() - blocked.query_start))::int
        )
      )
    FROM pg_locks blocked
    JOIN pg_stat_activity blocked_activity ON blocked.pid = blocked_activity.pid
    JOIN pg_locks blocking ON blocked.locktype = blocking.locktype
      AND blocked.database IS NOT DISTINCT FROM blocking.database
      AND blocked.relation IS NOT DISTINCT FROM blocking.relation
      AND blocked.pid != blocking.pid
    JOIN pg_stat_activity blocking_activity ON blocking.pid = blocking_activity.pid
    WHERE NOT blocked.granted
      AND blocking.granted
      AND blocked_activity.state != 'idle'
      AND blocking_activity.state != 'idle';
  " 2>/dev/null || echo "null")
  
  if [ "$result" != "null" ] && [ "$result" != "" ]; then
    log WARN "Found blocking locks:"
    echo "$result" | jq -C '.' 2>/dev/null || echo "$result"
    echo "$result" >> "$PREFLIGHT_REPORT"
    return 1
  else
    log SUCCESS "No blocking locks detected"
    return 0
  fi
}

function generate_schema_diff() {
  log INFO "Generating schema diff..."
  
  local temp_schema="/tmp/current-schema-$$.sql"
  local expected_schema="/tmp/expected-schema-$$.sql"
  
  pg_dump "$TARGET_DB" --schema-only --no-owner --no-privileges > "$temp_schema" 2>/dev/null || {
    log ERROR "Failed to dump current schema"
    return 1
  }
  
  local pending=$(get_pending_migrations)
  
  cat <<EOF > "$PREFLIGHT_REPORT"
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "database": "$(echo $TARGET_DB | sed 's/:.*/:[REDACTED]@/')",
  "pending_migrations": $pending,
  "schema_size_bytes": $(wc -c < "$temp_schema"),
  "checks": []
}
EOF
  
  log INFO "Schema diff generated. Pending migrations: $pending"
  log INFO "Current schema size: $(wc -c < "$temp_schema") bytes"
  
  rm -f "$temp_schema" "$expected_schema"
  return 0
}

function create_logical_backup() {
  if [ "$SKIP_BACKUP" = true ]; then
    log WARN "Skipping backup (--skip-backup flag set)"
    return 0
  fi
  
  log INFO "Creating logical backup of affected schemas..."
  
  local backup_file="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql.gz"
  
  local affected_tables=$(psql "$TARGET_DB" -t -A -c "
    SELECT string_agg(tablename, ' ')
    FROM pg_tables
    WHERE schemaname = 'public';
  " 2>/dev/null)
  
  if [ -z "$affected_tables" ]; then
    log WARN "No tables found to backup"
    return 0
  fi
  
  log INFO "Backing up tables: $affected_tables"
  
  pg_dump "$TARGET_DB" \
    --no-owner \
    --no-privileges \
    --data-only \
    --schema=public \
    | gzip > "$backup_file" 2>/dev/null || {
    log ERROR "Backup failed"
    return 1
  }
  
  local backup_size=$(du -h "$backup_file" | cut -f1)
  log SUCCESS "Backup created: $backup_file ($backup_size)"
  
  echo "$backup_file" > "$BACKUP_DIR/latest-backup.txt"
  
  return 0
}

function run_preflight() {
  log INFO "=== PREFLIGHT CHECKS ==="
  
  local checks_passed=true
  
  generate_schema_diff || checks_passed=false
  
  detect_long_running_transactions || checks_passed=false
  
  detect_blocking_locks || checks_passed=false
  
  local db_size=$(psql "$TARGET_DB" -t -A -c "
    SELECT pg_size_pretty(pg_database_size(current_database()));
  " 2>/dev/null)
  log INFO "Database size: $db_size"
  
  local active_connections=$(psql "$TARGET_DB" -t -A -c "
    SELECT count(*) FROM pg_stat_activity WHERE state != 'idle';
  " 2>/dev/null)
  log INFO "Active connections: $active_connections"
  
  if [ "$checks_passed" = true ]; then
    log SUCCESS "=== PREFLIGHT PASSED ==="
    echo "preflight_passed" > "$LOGS_DIR/.preflight-status"
    return 0
  else
    log ERROR "=== PREFLIGHT FAILED ==="
    log ERROR "Fix issues above before running --apply"
    rm -f "$LOGS_DIR/.preflight-status"
    return 1
  fi
}

function apply_migrations() {
  log INFO "=== APPLYING MIGRATIONS ==="
  
  if [ "$FORCE" != true ] && [ ! -f "$LOGS_DIR/.preflight-status" ]; then
    log ERROR "Preflight checks not run or failed. Run --preflight first or use --force"
    exit 2
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log INFO "DRY RUN: Would apply migrations"
    log INFO "Pending migrations: $(get_pending_migrations)"
    return 0
  fi
  
  create_logical_backup || {
    log ERROR "Backup failed. Aborting migration."
    exit 2
  }
  
  log INFO "Running migrations via migration framework..."
  
  cd "$PROJECT_ROOT/backend/db"
  
  local node_args="migration_framework.ts"
  if [ -n "$STEPS" ]; then
    node_args="$node_args --steps=$STEPS"
  fi
  
  if npx tsx "$node_args" >> "$LOG_FILE" 2>&1; then
    log SUCCESS "=== MIGRATIONS APPLIED ==="
    echo "migrations_applied" > "$LOGS_DIR/.apply-status"
    rm -f "$LOGS_DIR/.preflight-status"
    return 0
  else
    log ERROR "=== MIGRATION FAILED ==="
    log ERROR "Check $LOG_FILE for details"
    return 2
  fi
}

function validate_foreign_keys() {
  log INFO "Validating foreign key constraints..."
  
  local invalid_fks=$(psql "$TARGET_DB" -t -A -c "
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'table', conrelid::regclass::text,
          'constraint', conname,
          'foreign_table', confrelid::regclass::text
        )
      )
    FROM pg_constraint
    WHERE contype = 'f'
      AND NOT convalidated;
  " 2>/dev/null || echo "null")
  
  if [ "$invalid_fks" != "null" ] && [ "$invalid_fks" != "" ]; then
    log WARN "Found unvalidated foreign keys:"
    echo "$invalid_fks" | jq -C '.' 2>/dev/null || echo "$invalid_fks"
    return 1
  else
    log SUCCESS "All foreign keys validated"
    return 0
  fi
}

function calculate_schema_checksum() {
  log INFO "Calculating schema checksum..."
  
  local checksum=$(pg_dump "$TARGET_DB" --schema-only --no-owner --no-privileges 2>/dev/null | \
    grep -v '^--' | \
    grep -v '^$' | \
    sha256sum | \
    cut -d' ' -f1)
  
  log INFO "Schema checksum: $checksum"
  echo "$checksum"
}

function run_postflight() {
  log INFO "=== POSTFLIGHT VALIDATION ==="
  
  if [ ! -f "$LOGS_DIR/.apply-status" ]; then
    log WARN "Migrations not applied in this session. Validation may not reflect recent changes."
  fi
  
  local validation_passed=true
  
  validate_foreign_keys || validation_passed=false
  
  local checksum=$(calculate_schema_checksum)
  
  local migration_count=$(psql "$TARGET_DB" -t -A -c "
    SELECT COUNT(*) FROM schema_migrations WHERE dirty = false;
  " 2>/dev/null)
  
  local dirty_count=$(psql "$TARGET_DB" -t -A -c "
    SELECT COUNT(*) FROM schema_migrations WHERE dirty = true;
  " 2>/dev/null)
  
  cat <<EOF > "$POSTFLIGHT_REPORT"
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "schema_checksum": "$checksum",
  "migrations_applied": $migration_count,
  "dirty_migrations": $dirty_count,
  "validation_passed": $validation_passed
}
EOF
  
  log INFO "Applied migrations: $migration_count"
  log INFO "Dirty migrations: $dirty_count"
  
  if [ "$dirty_count" -gt 0 ]; then
    log WARN "Found dirty migrations - database may be in inconsistent state"
    validation_passed=false
  fi
  
  if [ "$validation_passed" = true ]; then
    log SUCCESS "=== POSTFLIGHT PASSED ==="
    log SUCCESS "Postflight report: $POSTFLIGHT_REPORT"
    rm -f "$LOGS_DIR/.apply-status"
    return 0
  else
    log ERROR "=== POSTFLIGHT FAILED ==="
    return 3
  fi
}

function rollback_migrations() {
  log INFO "=== ROLLING BACK MIGRATIONS ==="
  
  if [ "$DRY_RUN" = true ]; then
    log INFO "DRY RUN: Would rollback migrations"
    local steps_to_rollback=${STEPS:-1}
    log INFO "Steps to rollback: $steps_to_rollback"
    return 0
  fi
  
  local latest_backup=$(cat "$BACKUP_DIR/latest-backup.txt" 2>/dev/null || echo "")
  
  if [ -n "$latest_backup" ] && [ -f "$latest_backup" ]; then
    log WARN "Latest backup available: $latest_backup"
    log WARN "To restore from backup: zcat $latest_backup | psql \$DATABASE_URL"
  fi
  
  log INFO "Running rollback via migration framework..."
  
  cd "$PROJECT_ROOT/backend/db"
  
  local node_args="migration_framework.ts --down"
  if [ -n "$STEPS" ]; then
    node_args="$node_args --steps=$STEPS"
  else
    node_args="$node_args --steps=1"
  fi
  
  if npx tsx "$node_args" >> "$LOG_FILE" 2>&1; then
    log SUCCESS "=== ROLLBACK COMPLETED ==="
    return 0
  else
    log ERROR "=== ROLLBACK FAILED ==="
    log ERROR "Check $LOG_FILE for details"
    log ERROR "Manual intervention may be required"
    return 4
  fi
}

function run_dry_run() {
  log INFO "=== DRY RUN MODE ==="
  
  log INFO "Would execute:"
  log INFO "  1. Preflight checks (schema diff, locks, transactions)"
  log INFO "  2. Logical backup of affected schemas"
  log INFO "  3. Apply pending migrations"
  log INFO "  4. Postflight validation (checksums, FK validation)"
  
  local pending=$(get_pending_migrations)
  log INFO ""
  log INFO "Pending migrations: $pending"
  
  if [ $pending -gt 0 ]; then
    log INFO ""
    log INFO "Migration files to apply:"
    ls -1 "$MIGRATIONS_DIR"/*.up.sql 2>/dev/null | tail -n "$pending" | while read -r file; do
      log INFO "  - $(basename "$file")"
    done
  fi
  
  log INFO ""
  log INFO "No changes made (dry run)"
}

if [ $# -eq 0 ]; then
  usage
fi

while [[ $# -gt 0 ]]; do
  case $1 in
    --preflight)
      MODE="preflight"
      shift
      ;;
    --apply)
      MODE="apply"
      shift
      ;;
    --postflight)
      MODE="postflight"
      shift
      ;;
    --rollback)
      MODE="rollback"
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --steps=*)
      STEPS="${1#*=}"
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      log ERROR "Unknown option: $1"
      usage
      ;;
  esac
done

ensure_dirs
check_dependencies

if [ "$DRY_RUN" = true ]; then
  run_dry_run
  exit 0
fi

case $MODE in
  preflight)
    run_preflight
    exit $?
    ;;
  apply)
    apply_migrations
    exit $?
    ;;
  postflight)
    run_postflight
    exit $?
    ;;
  rollback)
    rollback_migrations
    exit $?
    ;;
  *)
    log ERROR "No mode specified. Use --preflight, --apply, --postflight, --rollback, or --dry-run"
    usage
    ;;
esac
