import db from "../../db";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

interface MigrationRecord {
  id: number;
  filename: string;
  applied_at: Date;
  checksum: string;
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
}

function calculateChecksum(content: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  await ensureMigrationTable();

  const migrationsDir = join(__dirname, "../../db/migrations");
  const files = await readdir(migrationsDir);
  const upFiles = files
    .filter(f => f.endsWith(".up.sql"))
    .sort();

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const filename of upFiles) {
    const existing = await db.queryRow<MigrationRecord>`
      SELECT * FROM schema_migrations WHERE filename = ${filename}
    `;

    const filePath = join(migrationsDir, filename);
    const content = await readFile(filePath, "utf-8");
    const checksum = calculateChecksum(content);

    if (existing) {
      if (existing.checksum !== checksum) {
        throw new Error(
          `Migration ${filename} has changed since it was applied. ` +
          `Expected checksum: ${existing.checksum}, got: ${checksum}`
        );
      }
      skipped.push(filename);
      continue;
    }

    console.log(`Applying migration: ${filename}`);
    
    try {
      await db.exec(content as any);
      
      await db.exec`
        INSERT INTO schema_migrations (filename, checksum)
        VALUES (${filename}, ${checksum})
      `;
      
      applied.push(filename);
      console.log(`✓ Applied: ${filename}`);
    } catch (error: any) {
      console.error(`✗ Failed to apply migration ${filename}:`, error.message);
      throw error;
    }
  }

  return { applied, skipped };
}
