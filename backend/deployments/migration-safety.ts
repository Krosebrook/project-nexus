import db from "../db";
import { validateMigrationRollback as validateSqlFile } from "./rollback-validator";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface MigrationRollbackValidation {
  canRollback: boolean;
  blockingReasons: string[];
}

export interface MigrationRollbackLog {
  id: number;
  migrationVersion: string;
  rollbackAttemptedAt: Date;
  rollbackCompletedAt?: Date;
  rollbackStatus: "pending" | "in_progress" | "completed" | "failed";
  rollbackErrors?: string;
  tableSnapshots?: Record<string, any>;
  affectedTables?: string[];
  performedBy?: string;
  metadata?: Record<string, any>;
}

export interface MigrationDependency {
  id: number;
  migrationVersion: string;
  dependsOnMigrations: string[];
  dependentMigrations: string[];
  hasDataMigration: boolean;
  hasDestructiveChanges: boolean;
  rollbackSafe: boolean;
  createdAt: Date;
}

export async function validateMigrationRollback(
  migrationVersion: string
): Promise<MigrationRollbackValidation> {
  const migrationFile = path.join(
    process.cwd(),
    "db/migrations",
    `${migrationVersion}.up.sql`
  );

  try {
    await fs.access(migrationFile);
    const sqlValidation = await validateSqlFile(migrationFile);
    return sqlValidation;
  } catch (fileError) {
  }

  const result = await db.queryRow<{
    can_rollback: boolean;
    blocking_reasons: string[];
  }>`
    SELECT * FROM validate_migration_rollback(${migrationVersion})
  `;

  if (!result) {
    return {
      canRollback: false,
      blockingReasons: ["Unable to validate migration rollback"],
    };
  }

  return {
    canRollback: result.can_rollback,
    blockingReasons: result.blocking_reasons || [],
  };
}

export async function logMigrationRollback(
  migrationVersion: string,
  performedBy?: string
): Promise<number> {
  const result = await db.queryRow<{ log_migration_rollback: number }>`
    SELECT log_migration_rollback(${migrationVersion}, ${performedBy || null})
  `;

  if (!result) {
    throw new Error("Failed to log migration rollback");
  }

  return result.log_migration_rollback;
}

export async function updateMigrationRollbackStatus(
  rollbackId: number,
  status: "in_progress" | "completed" | "failed",
  errors?: string,
  affectedTables?: string[]
): Promise<void> {
  await db.exec`
    UPDATE migration_rollback_log
    SET 
      rollback_status = ${status},
      rollback_completed_at = ${status === "completed" || status === "failed" ? "NOW()" : null},
      rollback_errors = ${errors || null},
      affected_tables = ${affectedTables || null}
    WHERE id = ${rollbackId}
  `;
}

export async function createTableSnapshot(
  migrationVersion: string,
  tables: string[]
): Promise<Record<string, any>> {
  const snapshots: Record<string, any> = {};

  for (const table of tables) {
    try {
      const query = `SELECT * FROM "${table}" LIMIT 1000`;
      const rows = await db.queryAll(query as any);
      snapshots[table] = {
        rowCount: rows.length,
        sampleData: rows.slice(0, 10),
      };
    } catch (error) {
      snapshots[table] = {
        error: (error as Error).message,
      };
    }
  }

  return snapshots;
}

export async function getMigrationDependencies(
  migrationVersion: string
): Promise<MigrationDependency | null> {
  const result = await db.queryRow<{
    id: number;
    migration_version: string;
    depends_on_migrations: string[];
    dependent_migrations: string[];
    has_data_migration: boolean;
    has_destructive_changes: boolean;
    rollback_safe: boolean;
    created_at: Date;
  }>`
    SELECT * FROM migration_dependencies
    WHERE migration_version = ${migrationVersion}
  `;

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    migrationVersion: result.migration_version,
    dependsOnMigrations: result.depends_on_migrations,
    dependentMigrations: result.dependent_migrations,
    hasDataMigration: result.has_data_migration,
    hasDestructiveChanges: result.has_destructive_changes,
    rollbackSafe: result.rollback_safe,
    createdAt: result.created_at,
  };
}

export async function canSafelyRollbackDeployment(
  deploymentId: number
): Promise<{
  safe: boolean;
  reasons: string[];
  affectedMigrations: string[];
}> {
  const deployment = await db.queryRow<{
    id: number;
    metadata: any;
  }>`
    SELECT id, metadata FROM deployment_logs WHERE id = ${deploymentId}
  `;

  if (!deployment) {
    return {
      safe: false,
      reasons: ["Deployment not found"],
      affectedMigrations: [],
    };
  }

  const migrations = deployment.metadata?.migrations || [];
  const reasons: string[] = [];
  const affectedMigrations: string[] = [];

  for (const migration of migrations) {
    const validation = await validateMigrationRollback(migration);
    if (!validation.canRollback) {
      reasons.push(
        `Migration ${migration}: ${validation.blockingReasons.join(", ")}`
      );
      affectedMigrations.push(migration);
    }
  }

  const recentDeployments = await db.queryAll<{ id: number }>`
    SELECT id FROM deployment_logs
    WHERE id > ${deploymentId}
      AND status = 'completed'
    ORDER BY id ASC
    LIMIT 5
  `;

  if (recentDeployments.length > 0) {
    reasons.push(
      `${recentDeployments.length} deployments have been made since this deployment. Rolling back may cause inconsistencies.`
    );
  }

  return {
    safe: reasons.length === 0,
    reasons,
    affectedMigrations,
  };
}
