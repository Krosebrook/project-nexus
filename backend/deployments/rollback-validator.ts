import { promises as fs } from "node:fs";

export interface RollbackValidation {
  canRollback: boolean;
  blockingReasons: string[];
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
  fileOrSql: string
): Promise<RollbackValidation> {
  const sql = await loadSql(fileOrSql);
  const n = normalize(sql);
  const reasons = new Set<string>();

  for (const p of DESTRUCTIVE_PATTERNS) {
    if (p.test(n)) reasons.add(`Destructive DDL: ${p}`);
  }

  for (const p of DATA_MUTATION_PATTERNS) {
    if (p.test(n)) reasons.add(`Data mutation: ${p}`);
  }

  const hasSafe = SAFE_SCHEMA_PATTERNS.some((p) => p.test(n));
  const hasHardBlock = reasons.size > 0;

  const canRollback = hasSafe && !hasHardBlock;
  return { canRollback, blockingReasons: Array.from(reasons) };
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
