/**
 * Schema preflight checks to ensure required columns exist before tests run.
 * Prevents cryptic runtime errors from schema drift.
 */

import database from "./index";

interface ColumnInfo {
  column_name: string;
}

async function mustHaveColumn(table: string, column: string): Promise<void> {
  const results: ColumnInfo[] = [];
  
  for await (const row of database.query<ColumnInfo>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = ${table} 
      AND column_name = ${column}
  `) {
    results.push(row);
  }

  if (results.length === 0) {
    throw new Error(
      `Schema preflight failed: missing column ${table}.${column}. ` +
      `Please run database migrations.`
    );
  }
}

export async function runSchemaPreflight(): Promise<void> {
  await mustHaveColumn("deployment_logs", "state_snapshot");
  await mustHaveColumn("deployment_logs", "created_at");
  await mustHaveColumn("deployment_logs", "updated_at");
  await mustHaveColumn("deployment_logs", "logs");
  await mustHaveColumn("deployment_logs", "stage");
  await mustHaveColumn("deployment_logs", "status");
}
