import db from "./index";
import { readdir, readFile, appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import { existsSync } from "fs";

interface MigrationRecord {
  version: string;
  applied_at: Date;
  checksum: string;
  dirty: boolean;
}

interface MigrationFile {
  version: string;
  filename: string;
  filepath: string;
  content: string;
  checksum: string;
  type: "up" | "down";
}

interface MigrationResult {
  success: boolean;
  applied: string[];
  skipped: string[];
  rolledBack: string[];
  dirty: string[];
  errors: Array<{ version: string; error: string }>;
  totalDurationMs: number;
}

interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  [key: string]: unknown;
}

const LOGS_DIR = join(__dirname, "../../logs");
const MIGRATIONS_LOG = join(LOGS_DIR, "migrations.jsonl");

function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...obj };
  const secretKeys = ["password", "secret", "token", "key", "connectionString", "DATABASE_URL"];
  
  for (const key of Object.keys(redacted)) {
    if (secretKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    }
    if (typeof redacted[key] === "object" && redacted[key] !== null) {
      redacted[key] = redactSecrets(redacted[key] as Record<string, unknown>);
    }
  }
  
  return redacted;
}

async function logJSON(level: LogEntry["level"], message: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redactSecrets(metadata)
  };
  
  console.log(JSON.stringify(entry));
  
  try {
    if (!existsSync(LOGS_DIR)) {
      await mkdir(LOGS_DIR, { recursive: true });
    }
    await appendFile(MIGRATIONS_LOG, JSON.stringify(entry) + "\n", "utf-8");
  } catch (error) {
    console.error("Failed to write to migration log file:", error);
  }
}

function calculateChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function ensureMigrationTable(): Promise<void> {
  await logJSON("debug", "Ensuring schema_migrations table exists");
  
  await db.exec`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT NOT NULL,
      dirty BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;
  
  await logJSON("info", "Migration tracking table ready", { table: "schema_migrations" });
}

async function getDirtyMigrations(): Promise<MigrationRecord[]> {
  const dirtyMigrations = await db.query<MigrationRecord>`
    SELECT version, applied_at, checksum, dirty
    FROM schema_migrations
    WHERE dirty = TRUE
    ORDER BY version ASC
  `;
  
  return dirtyMigrations;
}

async function setDirtyFlag(version: string, dirty: boolean): Promise<void> {
  await db.exec`
    UPDATE schema_migrations
    SET dirty = ${dirty}
    WHERE version = ${version}
  `;
  
  await logJSON(dirty ? "warn" : "info", "Migration dirty flag updated", { version, dirty });
}

async function getAppliedMigrations(): Promise<Map<string, MigrationRecord>> {
  const applied = await db.query<MigrationRecord>`
    SELECT version, applied_at, checksum, dirty
    FROM schema_migrations
    ORDER BY version ASC
  `;
  
  const map = new Map<string, MigrationRecord>();
  for (const migration of applied) {
    map.set(migration.version, migration);
  }
  
  return map;
}

async function loadMigrationFiles(migrationsDir: string, type: "up" | "down"): Promise<MigrationFile[]> {
  const files = await readdir(migrationsDir);
  const suffix = type === "up" ? ".up.sql" : ".down.sql";
  
  const migrationFiles: MigrationFile[] = [];
  
  for (const filename of files.filter(f => f.endsWith(suffix)).sort()) {
    const version = filename.replace(suffix, "");
    const filepath = join(migrationsDir, filename);
    const content = await readFile(filepath, "utf-8");
    const checksum = calculateChecksum(content);
    
    migrationFiles.push({
      version,
      filename,
      filepath,
      content,
      checksum,
      type
    });
  }
  
  return migrationFiles;
}

async function preflightChecks(migrations: MigrationFile[], appliedMap: Map<string, MigrationRecord>): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  await logJSON("info", "Running preflight checks", { migrationCount: migrations.length });
  
  for (const migration of migrations) {
    const applied = appliedMap.get(migration.version);
    
    if (applied && !applied.dirty) {
      if (applied.checksum !== migration.checksum) {
        errors.push(
          `Migration ${migration.version} checksum mismatch. ` +
          `Database: ${applied.checksum.substring(0, 16)}..., ` +
          `File: ${migration.checksum.substring(0, 16)}...`
        );
      }
    }
    
    if (migration.content.trim().length === 0) {
      errors.push(`Migration ${migration.version} is empty`);
    }
    
    const hasDangerousCommands = /\b(DROP\s+DATABASE|TRUNCATE|DELETE\s+FROM)\b/i.test(migration.content);
    if (hasDangerousCommands) {
      await logJSON("warn", "Migration contains potentially dangerous commands", {
        version: migration.version,
        warning: "Contains DROP DATABASE, TRUNCATE, or DELETE FROM"
      });
    }
  }
  
  if (errors.length > 0) {
    await logJSON("error", "Preflight checks failed", { errorCount: errors.length, errors });
    return { passed: false, errors };
  }
  
  await logJSON("info", "Preflight checks passed");
  return { passed: true, errors: [] };
}

async function applyMigration(migration: MigrationFile): Promise<void> {
  await logJSON("info", "Applying migration", {
    version: migration.version,
    type: migration.type,
    checksum: migration.checksum.substring(0, 16)
  });
  
  await db.exec`BEGIN`;
  
  try {
    await db.exec`
      INSERT INTO schema_migrations (version, checksum, dirty)
      VALUES (${migration.version}, ${migration.checksum}, TRUE)
      ON CONFLICT (version) DO UPDATE
      SET dirty = TRUE, checksum = ${migration.checksum}, applied_at = NOW()
    `;
    
    await db.exec(migration.content as any);
    
    await db.exec`
      UPDATE schema_migrations
      SET dirty = FALSE
      WHERE version = ${migration.version}
    `;
    
    await db.exec`COMMIT`;
    
    await logJSON("info", "Migration applied successfully", {
      version: migration.version,
      type: migration.type
    });
  } catch (error) {
    await db.exec`ROLLBACK`;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await logJSON("error", "Migration failed and was rolled back", {
      version: migration.version,
      type: migration.type,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw error;
  }
}

async function rollbackMigration(migration: MigrationFile): Promise<void> {
  await logJSON("info", "Rolling back migration", {
    version: migration.version,
    checksum: migration.checksum.substring(0, 16)
  });
  
  await db.exec`BEGIN`;
  
  try {
    await db.exec`
      UPDATE schema_migrations
      SET dirty = TRUE
      WHERE version = ${migration.version}
    `;
    
    await db.exec(migration.content as any);
    
    await db.exec`
      DELETE FROM schema_migrations
      WHERE version = ${migration.version}
    `;
    
    await db.exec`COMMIT`;
    
    await logJSON("info", "Migration rolled back successfully", {
      version: migration.version
    });
  } catch (error) {
    await db.exec`ROLLBACK`;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await logJSON("error", "Rollback failed", {
      version: migration.version,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw error;
  }
}

async function recoverDirtyMigration(version: string, downMigration: MigrationFile | undefined): Promise<boolean> {
  await logJSON("warn", "Attempting to recover dirty migration", { version });
  
  if (!downMigration) {
    await logJSON("error", "No down migration found for dirty migration", {
      version,
      suggestion: "Manually clean up the migration or provide a down migration"
    });
    return false;
  }
  
  try {
    await rollbackMigration(downMigration);
    await logJSON("info", "Dirty migration recovered successfully", { version });
    return true;
  } catch (error) {
    await logJSON("error", "Failed to recover dirty migration", {
      version,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export async function runMigrations(options: {
  direction?: "up" | "down";
  steps?: number;
  autoRecoverDirty?: boolean;
} = {}): Promise<MigrationResult> {
  const startTime = Date.now();
  const direction = options.direction || "up";
  const autoRecoverDirty = options.autoRecoverDirty ?? true;
  
  const result: MigrationResult = {
    success: true,
    applied: [],
    skipped: [],
    rolledBack: [],
    dirty: [],
    errors: [],
    totalDurationMs: 0
  };
  
  await logJSON("info", "Starting migration run", {
    direction,
    steps: options.steps,
    autoRecoverDirty
  });
  
  try {
    await ensureMigrationTable();
    
    const dirtyMigrations = await getDirtyMigrations();
    if (dirtyMigrations.length > 0) {
      await logJSON("warn", "Found migrations in dirty state", {
        count: dirtyMigrations.length,
        versions: dirtyMigrations.map(m => m.version)
      });
      
      result.dirty = dirtyMigrations.map(m => m.version);
      
      if (autoRecoverDirty && direction === "up") {
        const migrationsDir = join(__dirname, "./migrations");
        const downMigrations = await loadMigrationFiles(migrationsDir, "down");
        const downMap = new Map(downMigrations.map(m => [m.version, m]));
        
        for (const dirty of dirtyMigrations) {
          const recovered = await recoverDirtyMigration(dirty.version, downMap.get(dirty.version));
          if (recovered) {
            result.rolledBack.push(dirty.version);
          } else {
            result.success = false;
            result.errors.push({
              version: dirty.version,
              error: "Failed to recover dirty migration"
            });
            
            await logJSON("error", "Cannot proceed with dirty migrations", {
              dirtyVersions: [dirty.version]
            });
            
            result.totalDurationMs = Date.now() - startTime;
            return result;
          }
        }
      } else if (!autoRecoverDirty) {
        result.success = false;
        await logJSON("error", "Dirty migrations found and auto-recovery disabled", {
          dirtyVersions: result.dirty
        });
        result.totalDurationMs = Date.now() - startTime;
        return result;
      }
    }
    
    const migrationsDir = join(__dirname, "./migrations");
    const migrations = await loadMigrationFiles(migrationsDir, direction);
    const appliedMap = await getAppliedMigrations();
    
    await logJSON("info", "Loaded migration files", {
      direction,
      count: migrations.length,
      appliedCount: appliedMap.size
    });
    
    if (direction === "up") {
      const preflightResult = await preflightChecks(migrations, appliedMap);
      if (!preflightResult.passed) {
        result.success = false;
        result.errors.push(...preflightResult.errors.map(error => ({ version: "preflight", error })));
        result.totalDurationMs = Date.now() - startTime;
        return result;
      }
      
      let applied = 0;
      for (const migration of migrations) {
        if (options.steps && applied >= options.steps) {
          break;
        }
        
        const existing = appliedMap.get(migration.version);
        
        if (existing && !existing.dirty) {
          result.skipped.push(migration.version);
          await logJSON("debug", "Migration already applied, skipping", {
            version: migration.version,
            appliedAt: existing.applied_at
          });
          continue;
        }
        
        try {
          await applyMigration(migration);
          result.applied.push(migration.version);
          applied++;
        } catch (error) {
          result.success = false;
          result.errors.push({
            version: migration.version,
            error: error instanceof Error ? error.message : String(error)
          });
          
          result.totalDurationMs = Date.now() - startTime;
          return result;
        }
      }
    } else {
      const toRollback = Array.from(appliedMap.values())
        .filter(m => !m.dirty)
        .sort((a, b) => b.version.localeCompare(a.version))
        .slice(0, options.steps || 1);
      
      const downMap = new Map(migrations.map(m => [m.version, m]));
      
      for (const applied of toRollback) {
        const downMigration = downMap.get(applied.version);
        
        if (!downMigration) {
          result.success = false;
          result.errors.push({
            version: applied.version,
            error: "No down migration file found"
          });
          
          await logJSON("error", "Cannot rollback: down migration not found", {
            version: applied.version
          });
          
          result.totalDurationMs = Date.now() - startTime;
          return result;
        }
        
        try {
          await rollbackMigration(downMigration);
          result.rolledBack.push(applied.version);
        } catch (error) {
          result.success = false;
          result.errors.push({
            version: applied.version,
            error: error instanceof Error ? error.message : String(error)
          });
          
          result.totalDurationMs = Date.now() - startTime;
          return result;
        }
      }
    }
    
    result.totalDurationMs = Date.now() - startTime;
    
    await logJSON("info", "Migration run completed", {
      success: result.success,
      applied: result.applied.length,
      skipped: result.skipped.length,
      rolledBack: result.rolledBack.length,
      dirty: result.dirty.length,
      errors: result.errors.length,
      totalDurationMs: result.totalDurationMs
    });
    
    return result;
  } catch (error) {
    result.success = false;
    result.totalDurationMs = Date.now() - startTime;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await logJSON("error", "Migration run failed", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    result.errors.push({
      version: "system",
      error: errorMessage
    });
    
    return result;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const direction = args.includes("--down") || args.includes("down") ? "down" : "up";
  const stepsArg = args.find(arg => arg.startsWith("--steps="));
  const steps = stepsArg ? parseInt(stepsArg.split("=")[1], 10) : undefined;
  const autoRecoverDirty = !args.includes("--no-auto-recover");
  
  (async () => {
    const result = await runMigrations({ direction, steps, autoRecoverDirty });
    
    if (!result.success) {
      await logJSON("error", "Migration execution failed", {
        applied: result.applied,
        skipped: result.skipped,
        rolledBack: result.rolledBack,
        dirty: result.dirty,
        errors: result.errors
      });
      process.exit(1);
    }
    
    await logJSON("info", "All migrations completed successfully", {
      applied: result.applied,
      skipped: result.skipped,
      rolledBack: result.rolledBack,
      totalDurationMs: result.totalDurationMs
    });
    
    process.exit(0);
  })();
}
