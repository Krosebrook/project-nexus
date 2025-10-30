import { describe, it, expect, beforeEach, afterEach } from "vitest";
import db from "../../db";

describe("Database Provisioning Integration", () => {
  let testProjectId: string;

  beforeEach(async () => {
    const projectId = `test_proj_${Date.now()}`;
    await db.exec`
      INSERT INTO projects (id, name, description, status, health_score)
      VALUES (${projectId}, 'Test Project', 'Test provisioning', 'active', 100)
    `;
    testProjectId = projectId;
  });

  afterEach(async () => {
    await db.exec`DELETE FROM provisioned_databases WHERE project_id = ${testProjectId}`;
    await db.exec`DELETE FROM projects WHERE id = ${testProjectId}`;
  });

  describe("Provisioned Database Schema", () => {
    it("should insert a database provisioning record", async () => {
      const dbId = `db_test_${Date.now()}`;
      
      await db.exec`
        INSERT INTO provisioned_databases (
          id, project_id, provider, region, name, status
        ) VALUES (
          ${dbId}, ${testProjectId}, 'neon', 'aws-us-east-2', 'test-db', 'provisioning'
        )
      `;

      const result = await db.queryRow<{
        id: string;
        status: string;
        provider: string;
      }>`
        SELECT id, status, provider
        FROM provisioned_databases
        WHERE id = ${dbId}
      `;

      expect(result).not.toBeNull();
      expect(result?.id).toBe(dbId);
      expect(result?.status).toBe("provisioning");
      expect(result?.provider).toBe("neon");
    });

    it("should update database status to active", async () => {
      const dbId = `db_test_${Date.now()}`;
      
      await db.exec`
        INSERT INTO provisioned_databases (
          id, project_id, provider, region, name, status
        ) VALUES (
          ${dbId}, ${testProjectId}, 'neon', 'aws-us-east-2', 'test-db', 'provisioning'
        )
      `;

      await db.exec`
        UPDATE provisioned_databases
        SET 
          status = 'active',
          host = 'ep-test-123.us-east-2.aws.neon.tech',
          port = 5432,
          database_name = 'testdb'
        WHERE id = ${dbId}
      `;

      const result = await db.queryRow<{
        status: string;
        host: string;
      }>`
        SELECT status, host
        FROM provisioned_databases
        WHERE id = ${dbId}
      `;

      expect(result?.status).toBe("active");
      expect(result?.host).toBe("ep-test-123.us-east-2.aws.neon.tech");
    });

    it("should enforce unique constraint on project_id, provider, and name", async () => {
      const dbId1 = `db_test_1_${Date.now()}`;
      const dbId2 = `db_test_2_${Date.now()}`;

      await db.exec`
        INSERT INTO provisioned_databases (
          id, project_id, provider, region, name, status
        ) VALUES (
          ${dbId1}, ${testProjectId}, 'neon', 'aws-us-east-2', 'duplicate-name', 'active'
        )
      `;

      await expect(
        db.exec`
          INSERT INTO provisioned_databases (
            id, project_id, provider, region, name, status
          ) VALUES (
            ${dbId2}, ${testProjectId}, 'neon', 'aws-us-east-2', 'duplicate-name', 'active'
          )
        `
      ).rejects.toThrow();
    });

    it("should cascade delete when project is deleted", async () => {
      const dbId = `db_test_${Date.now()}`;
      
      await db.exec`
        INSERT INTO provisioned_databases (
          id, project_id, provider, region, name, status
        ) VALUES (
          ${dbId}, ${testProjectId}, 'neon', 'aws-us-east-2', 'test-db', 'active'
        )
      `;

      await db.exec`DELETE FROM projects WHERE id = ${testProjectId}`;

      const result = await db.queryRow<{ id: string }>`
        SELECT id FROM provisioned_databases WHERE id = ${dbId}
      `;

      expect(result).toBeNull();
    });
  });

  describe("Connection Logs Schema", () => {
    it("should insert connection log records", async () => {
      const dbId = `db_test_${Date.now()}`;
      const logId = `log_test_${Date.now()}`;
      
      await db.exec`
        INSERT INTO provisioned_databases (
          id, project_id, provider, region, name, status
        ) VALUES (
          ${dbId}, ${testProjectId}, 'neon', 'aws-us-east-2', 'test-db', 'active'
        )
      `;

      await db.exec`
        INSERT INTO database_connection_logs (
          id, database_id, event_type, details
        ) VALUES (
          ${logId}, ${dbId}, 'connection_success', 
          ${JSON.stringify({ host: "test-host", port: 5432 })}
        )
      `;

      const result = await db.queryRow<{
        event_type: string;
        details: any;
      }>`
        SELECT event_type, details
        FROM database_connection_logs
        WHERE id = ${logId}
      `;

      expect(result?.event_type).toBe("connection_success");
      expect(result?.details).toHaveProperty("host", "test-host");
    });

    it("should cascade delete logs when database is deleted", async () => {
      const dbId = `db_test_${Date.now()}`;
      const logId = `log_test_${Date.now()}`;
      
      await db.exec`
        INSERT INTO provisioned_databases (
          id, project_id, provider, region, name, status
        ) VALUES (
          ${dbId}, ${testProjectId}, 'neon', 'aws-us-east-2', 'test-db', 'active'
        )
      `;

      await db.exec`
        INSERT INTO database_connection_logs (
          id, database_id, event_type
        ) VALUES (
          ${logId}, ${dbId}, 'pool_created'
        )
      `;

      await db.exec`DELETE FROM provisioned_databases WHERE id = ${dbId}`;

      const result = await db.queryRow<{ id: string }>`
        SELECT id FROM database_connection_logs WHERE id = ${logId}
      `;

      expect(result).toBeNull();
    });
  });
});
