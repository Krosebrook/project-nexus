import db from "../../db";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

interface MigrationRecord {
  id: number;
  filename: string;
  applied_at: Date;
  checksum: string;
}

interface MigrationResult {
  applied: string[];
  skipped: string[];
  totalDurationMs: number;
  success: boolean;
  error?: string;
}

function logJSON(level: string, message: string, metadata: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata
  }));
}

function calculateChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function ensureMigrationTable(): Promise<void> {
  await db.exec`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
      checksum TEXT NOT NULL
    )
  `;
  logJSON("info", "Migration tracking table ready", { table: "schema_migrations" });
}

async function getMigrationsToApply(migrationsDir: string): Promise<string[]> {
  const files = await readdir(migrationsDir);
  const upFiles = files
    .filter(f => f.endsWith(".up.sql"))
    .sort();
  
  logJSON("info", "Found migration files", { count: upFiles.length, files: upFiles });
  return upFiles;
}

async function applyMigrationInTransaction(
  filename: string,
  content: string,
  checksum: string
): Promise<void> {
  await db.exec`BEGIN`;
  
  try {
    await db.exec(content as any);
    
    await db.exec`
      INSERT INTO schema_migrations (filename, checksum)
      VALUES (${filename}, ${checksum})
    `;
    
    await db.exec`COMMIT`;
    
    logJSON("info", "Migration applied successfully", { filename, checksum: checksum.substring(0, 16) });
  } catch (error) {
    await db.exec`ROLLBACK`;
    throw error;
  }
}

export async function runMigrations(): Promise<MigrationResult> {
  const startTime = Date.now();
  const applied: string[] = [];
  const skipped: string[] = [];
  
  logJSON("info", "Starting migration run");

  try {
    await ensureMigrationTable();

    const migrationsDir = join(__dirname, "../../db/migrations");
    const upFiles = await getMigrationsToApply(migrationsDir);

    if (upFiles.length === 0) {
      logJSON("warn", "No migration files found", { migrationsDir });
      return {
        applied,
        skipped,
        totalDurationMs: Date.now() - startTime,
        success: true
      };
    }

    for (const filename of upFiles) {
      const existing = await db.queryRow<MigrationRecord>`
        SELECT * FROM schema_migrations WHERE filename = ${filename}
      `;

      const filePath = join(migrationsDir, filename);
      const content = await readFile(filePath, "utf-8");
      const checksum = calculateChecksum(content);

      if (existing) {
        if (existing.checksum !== checksum) {
          const error = `Migration ${filename} has changed since it was applied. ` +
            `Expected checksum: ${existing.checksum.substring(0, 16)}..., ` +
            `got: ${checksum.substring(0, 16)}...`;
          
          logJSON("error", "Migration checksum mismatch", {
            filename,
            expectedChecksum: existing.checksum,
            actualChecksum: checksum
          });
          
          return {
            applied,
            skipped,
            totalDurationMs: Date.now() - startTime,
            success: false,
            error
          };
        }
        
        skipped.push(filename);
        logJSON("debug", "Migration already applied, skipping", {
          filename,
          appliedAt: existing.applied_at
        });
        continue;
      }

      logJSON("info", "Applying migration", { filename });
      
      try {
        await applyMigrationInTransaction(filename, content, checksum);
        applied.push(filename);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logJSON("error", "Migration failed", {
          filename,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        return {
          applied,
          skipped,
          totalDurationMs: Date.now() - startTime,
          success: false,
          error: `Failed to apply migration ${filename}: ${errorMessage}`
        };
      }
    }

    const totalDurationMs = Date.now() - startTime;
    
    logJSON("info", "Migration run completed", {
      applied: applied.length,
      skipped: skipped.length,
      totalDurationMs
    });

    return {
      applied,
      skipped,
      totalDurationMs,
      success: true
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logJSON("error", "Migration run failed", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      applied,
      skipped,
      totalDurationMs: Date.now() - startTime,
      success: false,
      error: errorMessage
    };
  }
}

if (require.main === module) {
  (async () => {
    const result = await runMigrations();
    
    if (!result.success) {
      logJSON("error", "Migration execution failed", {
        error: result.error,
        applied: result.applied,
        skipped: result.skipped
      });
      process.exit(1);
    }
    
    logJSON("info", "All migrations completed successfully", {
      applied: result.applied,
      skipped: result.skipped,
      totalDurationMs: result.totalDurationMs
    });
    process.exit(0);
  })();
}
