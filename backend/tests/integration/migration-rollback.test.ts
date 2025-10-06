import { describe, it, expect, beforeEach } from "vitest";
import {
  validateMigrationRollback,
  logMigrationRollback,
  canSafelyRollbackDeployment,
  getMigrationDependencies,
} from "../../deployments/migration-safety";

describe("Migration Rollback Safety E2E Tests", () => {
  describe("Migration validation", () => {
    it("should validate safe migrations", async () => {
      const result = await validateMigrationRollback("001_create_schema");
      
      expect(result.canRollback).toBe(true);
      expect(result.blockingReasons).toHaveLength(0);
    });

    it("should detect blocking reasons for unsafe migrations", async () => {
      const result = await validateMigrationRollback("nonexistent_migration");
      
      expect(result.canRollback).toBe(false);
      expect(result.blockingReasons.length).toBeGreaterThan(0);
    });

    it("should retrieve migration dependencies", async () => {
      const deps = await getMigrationDependencies("001_create_schema");
      
      expect(deps).toBeDefined();
      expect(deps?.rollbackSafe).toBe(true);
      expect(deps?.hasDestructiveChanges).toBe(false);
    });
  });

  describe("Rollback logging", () => {
    it("should log migration rollback attempts", async () => {
      const rollbackId = await logMigrationRollback(
        "001_create_schema",
        "test_user"
      );
      
      expect(rollbackId).toBeGreaterThan(0);
    });

    it("should track multiple rollback attempts", async () => {
      const id1 = await logMigrationRollback("001_create_schema", "user1");
      const id2 = await logMigrationRollback("002_seed_data", "user2");
      
      expect(id1).not.toBe(id2);
      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
    });
  });

  describe("Deployment rollback safety", () => {
    it("should validate deployment rollback safety", async () => {
      const result = await canSafelyRollbackDeployment(1);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty("safe");
      expect(result).toHaveProperty("reasons");
      expect(result).toHaveProperty("affectedMigrations");
    });

    it("should detect when deployment cannot be found", async () => {
      const result = await canSafelyRollbackDeployment(999999);
      
      expect(result.safe).toBe(false);
      expect(result.reasons).toContain("Deployment not found");
    });
  });

  describe("Data migration detection", () => {
    it("should identify migrations with data changes", async () => {
      const deps = await getMigrationDependencies("002_seed_data");
      
      expect(deps).toBeDefined();
      expect(deps?.hasDataMigration).toBe(true);
    });

    it("should identify schema-only migrations", async () => {
      const deps = await getMigrationDependencies("001_create_schema");
      
      expect(deps).toBeDefined();
      expect(deps?.hasDataMigration).toBe(false);
    });
  });
});
