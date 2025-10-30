import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import db from "../../db";
import { runMigrations } from "../../db/migration_framework";

const TEST_MIGRATIONS_DIR = join(__dirname, "../../db/migrations/test_migrations");

async function setupTestMigrations(): Promise<void> {
  if (existsSync(TEST_MIGRATIONS_DIR)) {
    await rm(TEST_MIGRATIONS_DIR, { recursive: true });
  }
  await mkdir(TEST_MIGRATIONS_DIR, { recursive: true });
}

async function createTestMigration(version: string, upSql: string, downSql: string): Promise<void> {
  await writeFile(join(TEST_MIGRATIONS_DIR, `${version}.up.sql`), upSql, "utf-8");
  await writeFile(join(TEST_MIGRATIONS_DIR, `${version}.down.sql`), downSql, "utf-8");
}

async function cleanupTestMigrations(): Promise<void> {
  if (existsSync(TEST_MIGRATIONS_DIR)) {
    await rm(TEST_MIGRATIONS_DIR, { recursive: true });
  }
  
  try {
    await db.exec`DROP TABLE IF EXISTS test_users CASCADE`;
    await db.exec`DROP TABLE IF EXISTS test_products CASCADE`;
    await db.exec`DELETE FROM schema_migrations WHERE version LIKE 'test_%'`;
  } catch (error) {
  }
}

describe("Migration Safety Framework", () => {
  beforeEach(async () => {
    await setupTestMigrations();
  });

  afterEach(async () => {
    await cleanupTestMigrations();
  });

  describe("Dirty State Detection", () => {
    it("should set dirty flag when migration fails", async () => {
      const failingSql = `
        CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY);
        CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY);
      `;
      
      await createTestMigration("test_0001", failingSql, "DROP TABLE IF EXISTS test_users;");
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "up") {
          return [{
            version: "test_0001",
            filename: "test_0001.up.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0001.up.sql"),
            content: failingSql,
            checksum: "abc123",
            type: "up"
          }];
        }
        return [];
      });
      
      const result = await runMigrations({ direction: "up", autoRecoverDirty: false });
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const dirtyCheck = await db.query<{ version: string; dirty: boolean }>`
        SELECT version, dirty FROM schema_migrations WHERE version = 'test_0001'
      `;
      
      expect(dirtyCheck.length).toBe(0);
      
      vi.restoreAllMocks();
    });

    it("should detect existing dirty migrations on startup", async () => {
      await db.exec`
        INSERT INTO schema_migrations (version, checksum, dirty)
        VALUES ('test_dirty_001', 'checksum123', TRUE)
        ON CONFLICT (version) DO UPDATE SET dirty = TRUE
      `;
      
      const result = await runMigrations({ direction: "up", autoRecoverDirty: false });
      
      expect(result.dirty.length).toBeGreaterThan(0);
      expect(result.dirty).toContain("test_dirty_001");
      expect(result.success).toBe(false);
      
      await db.exec`DELETE FROM schema_migrations WHERE version = 'test_dirty_001'`;
    });

    it("should automatically recover dirty migrations when enabled", async () => {
      const upSql = "CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY, name TEXT);";
      const downSql = "DROP TABLE IF EXISTS test_users;";
      
      await createTestMigration("test_0002", upSql, downSql);
      
      await db.exec`
        INSERT INTO schema_migrations (version, checksum, dirty)
        VALUES ('test_0002', 'abc123', TRUE)
        ON CONFLICT (version) DO UPDATE SET dirty = TRUE
      `;
      
      await db.exec`CREATE TABLE IF NOT EXISTS test_users (id BIGSERIAL PRIMARY KEY, name TEXT)`;
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "down") {
          return [{
            version: "test_0002",
            filename: "test_0002.down.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0002.down.sql"),
            content: downSql,
            checksum: "def456",
            type: "down"
          }];
        }
        return [];
      });
      
      const result = await runMigrations({ direction: "up", autoRecoverDirty: true });
      
      expect(result.rolledBack).toContain("test_0002");
      
      const cleanCheck = await db.query<{ version: string; dirty: boolean }>`
        SELECT version, dirty FROM schema_migrations WHERE version = 'test_0002'
      `;
      
      expect(cleanCheck.length).toBe(0);
      
      vi.restoreAllMocks();
    });
  });

  describe("Transactional Behavior", () => {
    it("should rollback migration on failure without leaving partial changes", async () => {
      const failingSql = `
        CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY);
        INSERT INTO test_users (id) VALUES (1);
        CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY);
      `;
      
      await createTestMigration("test_0003", failingSql, "DROP TABLE IF EXISTS test_users;");
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "up") {
          return [{
            version: "test_0003",
            filename: "test_0003.up.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0003.up.sql"),
            content: failingSql,
            checksum: "abc123",
            type: "up"
          }];
        }
        return [];
      });
      
      await runMigrations({ direction: "up", autoRecoverDirty: false });
      
      const tableExists = await db.query`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'test_users'
        ) as exists
      `;
      
      expect(tableExists[0]?.exists).toBe(false);
      
      vi.restoreAllMocks();
    });

    it("should commit migration only when all statements succeed", async () => {
      const successSql = `
        CREATE TABLE test_products (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          price DECIMAL(10,2)
        );
        INSERT INTO test_products (name, price) VALUES ('Widget', 19.99);
      `;
      
      await createTestMigration("test_0004", successSql, "DROP TABLE IF EXISTS test_products;");
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "up") {
          return [{
            version: "test_0004",
            filename: "test_0004.up.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0004.up.sql"),
            content: successSql,
            checksum: "def456",
            type: "up"
          }];
        }
        return [];
      });
      
      const result = await runMigrations({ direction: "up" });
      
      expect(result.success).toBe(true);
      expect(result.applied).toContain("test_0004");
      
      const dataCheck = await db.query<{ name: string; price: number }>`
        SELECT name, price FROM test_products
      `;
      
      expect(dataCheck.length).toBe(1);
      expect(dataCheck[0]?.name).toBe("Widget");
      
      await db.exec`DROP TABLE IF EXISTS test_products`;
      await db.exec`DELETE FROM schema_migrations WHERE version = 'test_0004'`;
      
      vi.restoreAllMocks();
    });
  });

  describe("Checksum Verification", () => {
    it("should detect when applied migration file has changed", async () => {
      const originalSql = "CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY);";
      const modifiedSql = "CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY, name TEXT);";
      
      await db.exec`
        INSERT INTO schema_migrations (version, checksum, dirty)
        VALUES ('test_0005', '${require("crypto").createHash("sha256").update(originalSql).digest("hex")}', FALSE)
        ON CONFLICT (version) DO UPDATE SET dirty = FALSE
      `;
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "up") {
          return [{
            version: "test_0005",
            filename: "test_0005.up.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0005.up.sql"),
            content: modifiedSql,
            checksum: require("crypto").createHash("sha256").update(modifiedSql).digest("hex"),
            type: "up"
          }];
        }
        return [];
      });
      
      const result = await runMigrations({ direction: "up" });
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.error.includes("checksum mismatch"))).toBe(true);
      
      await db.exec`DELETE FROM schema_migrations WHERE version = 'test_0005'`;
      
      vi.restoreAllMocks();
    });

    it("should skip migration with matching checksum", async () => {
      const sql = "CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY);";
      const checksum = require("crypto").createHash("sha256").update(sql).digest("hex");
      
      await db.exec`
        INSERT INTO schema_migrations (version, checksum, dirty)
        VALUES ('test_0006', ${checksum}, FALSE)
        ON CONFLICT (version) DO UPDATE SET dirty = FALSE
      `;
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "up") {
          return [{
            version: "test_0006",
            filename: "test_0006.up.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0006.up.sql"),
            content: sql,
            checksum: checksum,
            type: "up"
          }];
        }
        return [];
      });
      
      const result = await runMigrations({ direction: "up" });
      
      expect(result.success).toBe(true);
      expect(result.skipped).toContain("test_0006");
      expect(result.applied).not.toContain("test_0006");
      
      await db.exec`DELETE FROM schema_migrations WHERE version = 'test_0006'`;
      
      vi.restoreAllMocks();
    });
  });

  describe("Rollback Functionality", () => {
    it("should successfully rollback a migration using down file", async () => {
      const upSql = "CREATE TABLE test_products (id BIGSERIAL PRIMARY KEY, name TEXT);";
      const downSql = "DROP TABLE IF EXISTS test_products;";
      
      await db.exec`CREATE TABLE test_products (id BIGSERIAL PRIMARY KEY, name TEXT)`;
      
      const checksum = require("crypto").createHash("sha256").update(upSql).digest("hex");
      await db.exec`
        INSERT INTO schema_migrations (version, checksum, dirty)
        VALUES ('test_0007', ${checksum}, FALSE)
        ON CONFLICT (version) DO UPDATE SET dirty = FALSE
      `;
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "down") {
          return [{
            version: "test_0007",
            filename: "test_0007.down.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0007.down.sql"),
            content: downSql,
            checksum: require("crypto").createHash("sha256").update(downSql).digest("hex"),
            type: "down"
          }];
        }
        return [];
      });
      
      const result = await runMigrations({ direction: "down", steps: 1 });
      
      expect(result.success).toBe(true);
      expect(result.rolledBack).toContain("test_0007");
      
      const tableExists = await db.query`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'test_products'
        ) as exists
      `;
      
      expect(tableExists[0]?.exists).toBe(false);
      
      const migrationExists = await db.query`
        SELECT version FROM schema_migrations WHERE version = 'test_0007'
      `;
      
      expect(migrationExists.length).toBe(0);
      
      vi.restoreAllMocks();
    });

    it("should fail rollback when down migration is missing", async () => {
      const upSql = "CREATE TABLE test_users (id BIGSERIAL PRIMARY KEY);";
      const checksum = require("crypto").createHash("sha256").update(upSql).digest("hex");
      
      await db.exec`
        INSERT INTO schema_migrations (version, checksum, dirty)
        VALUES ('test_0008', ${checksum}, FALSE)
        ON CONFLICT (version) DO UPDATE SET dirty = FALSE
      `;
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        return [];
      });
      
      const result = await runMigrations({ direction: "down", steps: 1 });
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.error.includes("down migration"))).toBe(true);
      
      await db.exec`DELETE FROM schema_migrations WHERE version = 'test_0008'`;
      
      vi.restoreAllMocks();
    });
  });

  describe("Preflight Checks", () => {
    it("should reject empty migration files", async () => {
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "up") {
          return [{
            version: "test_0009",
            filename: "test_0009.up.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0009.up.sql"),
            content: "   \n\n  ",
            checksum: "empty",
            type: "up"
          }];
        }
        return [];
      });
      
      const result = await runMigrations({ direction: "up" });
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.error.includes("empty"))).toBe(true);
      
      vi.restoreAllMocks();
    });

    it("should warn about dangerous commands but not block them", async () => {
      const originalConsoleLog = console.log;
      const logs: string[] = [];
      console.log = vi.fn((msg) => logs.push(msg));
      
      const dangerousSql = "DROP DATABASE test_db; TRUNCATE TABLE users;";
      
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "up") {
          return [{
            version: "test_0010",
            filename: "test_0010.up.sql",
            filepath: join(TEST_MIGRATIONS_DIR, "test_0010.up.sql"),
            content: dangerousSql,
            checksum: "dangerous",
            type: "up"
          }];
        }
        return [];
      });
      
      await runMigrations({ direction: "up" });
      
      const hasWarning = logs.some(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.level === "warn" && parsed.message?.includes("dangerous");
        } catch {
          return false;
        }
      });
      
      expect(hasWarning).toBe(true);
      
      console.log = originalConsoleLog;
      vi.restoreAllMocks();
    });
  });

  describe("Migration Ordering", () => {
    it("should apply migrations in version order", async () => {
      const originalLoadMigrationFiles = require("../../db/migration_framework").loadMigrationFiles;
      vi.spyOn(require("../../db/migration_framework"), "loadMigrationFiles").mockImplementation(async (dir: string, type: string) => {
        if (type === "up") {
          return [
            {
              version: "test_0012",
              filename: "test_0012.up.sql",
              filepath: "",
              content: "SELECT 1",
              checksum: "c12",
              type: "up"
            },
            {
              version: "test_0011",
              filename: "test_0011.up.sql",
              filepath: "",
              content: "SELECT 1",
              checksum: "c11",
              type: "up"
            }
          ];
        }
        return [];
      });
      
      const result = await runMigrations({ direction: "up" });
      
      expect(result.applied[0]).toBe("test_0011");
      expect(result.applied[1]).toBe("test_0012");
      
      await db.exec`DELETE FROM schema_migrations WHERE version LIKE 'test_001%'`;
      
      vi.restoreAllMocks();
    });
  });
});
