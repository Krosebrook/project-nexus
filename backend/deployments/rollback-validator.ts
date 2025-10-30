import { promises as fs } from "node:fs";
import db from "../db";

export interface RollbackValidation {
  canRollback: boolean;
  blockingReasons: string[];
  warnings: string[];
  affectedRecords: Record<string, number>;
  requiresForce: boolean;
}

export interface SafetyCheckResult {
  passed: boolean;
  warnings: string[];
  blockers: string[];
  affectedTables: string[];
  affectedRecordsCount: Record<string, number>;
}

const SAFE_SCHEMA_PATTERNS = [
  /\bCREATE\s+SCHEMA\b/i,
  /\bCREATE\s+TABLE\b/i,
  /\bCREATE\s+(UNIQUE\s+)?INDEX(\s+CONCURRENTLY)?\b/i,
  /\bALTER\s+TABLE\b.*\bADD\s+COLUMN\b.*\bNULL\b/i,
  /\bALTER\s+TABLE\b.*\bADD\s+COLUMN\b.*\bDEFAULT\s+NULL\b/i,
  /\bALTER\s+TABLE\b.*\bALTER\s+COLUMN\b.*\bSET\s+DEFAULT\s+NULL\b/i,
  /\bCOMMENT\s+ON\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
];

const DESTRUCTIVE_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bALTER\s+TABLE\b.*\bDROP\b/i,
  /\bALTER\s+TYPE\b.*\bDROP\b/i,
  /\bTRUNCATE\b/i,
];

const DATA_MUTATION_PATTERNS = [
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\b\s+\w+\s+SET\b/i,
  /\bDELETE\s+FROM\b/i,
];

function normalize(sql: string): string {
  const noBlock = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock.replace(/--.*$/gm, "");
  const noStrings = noLine.replace(/'(?:''|[^'])*'/g, "''");
  return noStrings.replace(/\s+/g, " ").trim();
}

export async function validateMigrationRollback(
  fileOrSql: string,
  options: { forceRollback?: boolean } = {}
): Promise<RollbackValidation> {
  const sql = await loadSql(fileOrSql);
  const n = normalize(sql);
  const reasons = new Set<string>();
  const warnings: string[] = [];
  const affectedRecords: Record<string, number> = {};

  for (const p of DESTRUCTIVE_PATTERNS) {
    if (p.test(n)) reasons.add(`Destructive DDL detected`);
  }

  for (const p of DATA_MUTATION_PATTERNS) {
    if (p.test(n)) reasons.add(`Data mutation detected`);
  }

  const databaseChecks = await performDatabaseSafetyChecks(sql);
  
  if (databaseChecks.blockers.length > 0) {
    databaseChecks.blockers.forEach(b => reasons.add(b));
  }
  
  warnings.push(...databaseChecks.warnings);
  Object.assign(affectedRecords, databaseChecks.affectedRecordsCount);

  const hasSafe = SAFE_SCHEMA_PATTERNS.some((p) => p.test(n));
  const hasHardBlock = reasons.size > 0;

  const canRollback = options.forceRollback || (hasSafe && !hasHardBlock);
  const requiresForce = hasHardBlock && !options.forceRollback;

  return { 
    canRollback, 
    blockingReasons: Array.from(reasons),
    warnings,
    affectedRecords,
    requiresForce
  };
}

export async function performDatabaseSafetyChecks(sql: string): Promise<SafetyCheckResult> {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const affectedTables: string[] = [];
  const affectedRecordsCount: Record<string, number> = {};

  try {
    const activeDeploymentsResult = await db.queryRow<{
      active_deployments: number;
      has_active: boolean;
      warning: string | null;
    }>`SELECT * FROM check_active_deployments()`;

    if (activeDeploymentsResult?.has_active) {
      blockers.push(
        `${activeDeploymentsResult.active_deployments} active deployment(s) in progress. ` +
        `Wait for completion or use --force-rollback flag.`
      );
    }

    const tableDropMatch = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/gi);
    if (tableDropMatch) {
      for (const match of tableDropMatch) {
        const tableName = match.replace(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?/i, '').trim();
        affectedTables.push(tableName);

        try {
          affectedRecordsCount[tableName] = 0;
        } catch (error) {
        }
      }
    }

    const dependencies = await db.queryAll<{
      child_table: string;
      foreign_key_name: string;
    }>`
      SELECT child_table, foreign_key_name
      FROM migration_dependencies
      WHERE parent_table = ANY(${affectedTables})
    `;

    if (dependencies.length > 0) {
      warnings.push(
        `${dependencies.length} dependent table(s) will be affected: ` +
        dependencies.map((d: { child_table: string }) => d.child_table).join(', ')
      );
    }

  } catch (error) {
    warnings.push(`Unable to complete all safety checks: ${error}`);
  }

  return {
    passed: blockers.length === 0,
    warnings,
    blockers,
    affectedTables,
    affectedRecordsCount
  };
}

export async function logRollbackAttempt(
  migrationName: string,
  migrationVersion: string,
  safetyChecks: SafetyCheckResult,
  initiatedBy: string = 'system'
): Promise<bigint> {
  const result = await db.queryRow<{ id: bigint }>`
    INSERT INTO migration_rollback_audit (
      migration_name,
      migration_version,
      rollback_type,
      initiated_by,
      safety_checks_passed,
      affected_tables,
      affected_records_count,
      warnings,
      status
    ) VALUES (
      ${migrationName},
      ${migrationVersion},
      'manual',
      ${initiatedBy},
      ${safetyChecks.passed},
      ${safetyChecks.affectedTables},
      ${JSON.stringify(safetyChecks.affectedRecordsCount)},
      ${safetyChecks.warnings},
      ${safetyChecks.passed ? 'pending' : 'blocked'}
    )
    RETURNING id
  `;
  
  return result!.id;
}

export async function updateRollbackStatus(
  auditId: bigint,
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  await db.exec`
    UPDATE migration_rollback_audit
    SET status = ${status},
        completed_at = NOW(),
        error_message = ${errorMessage || null}
    WHERE id = ${auditId}
  `;
}

async function loadSql(fileOrSql: string): Promise<string> {
  if (
    /\s/.test(fileOrSql) &&
    /(;|\bcreate\b|\balter\b|\bdrop\b)/i.test(fileOrSql)
  ) {
    return fileOrSql;
  }
  return fs.readFile(fileOrSql, "utf8");
}
