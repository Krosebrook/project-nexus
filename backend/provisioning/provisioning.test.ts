import { describe, it, expect, beforeEach } from "vitest";
import { NeonClient } from "./neon-client";

describe("Neon Database Provisioning", () => {
  describe("NeonClient", () => {
    it("should parse connection string correctly", () => {
      const mockConnectionString = 
        "postgresql://user:password@ep-test-123.us-east-2.aws.neon.tech/mydb?sslmode=require";
      
      const client = new NeonClient("fake-api-key");
      const config = client.parseConnectionString(mockConnectionString);

      expect(config.host).toBe("ep-test-123.us-east-2.aws.neon.tech");
      expect(config.port).toBe(5432);
      expect(config.database).toBe("mydb");
      expect(config.username).toBe("user");
      expect(config.password).toBe("password");
      expect(config.sslmode).toBe("require");
    });

    it("should parse connection string with custom port", () => {
      const mockConnectionString = 
        "postgresql://user:password@ep-test-123.us-east-2.aws.neon.tech:5433/mydb";
      
      const client = new NeonClient("fake-api-key");
      const config = client.parseConnectionString(mockConnectionString);

      expect(config.port).toBe(5433);
    });

    it("should default to require sslmode if not specified", () => {
      const mockConnectionString = 
        "postgresql://user:password@ep-test-123.us-east-2.aws.neon.tech/mydb";
      
      const client = new NeonClient("fake-api-key");
      const config = client.parseConnectionString(mockConnectionString);

      expect(config.sslmode).toBe("require");
    });
  });
});
