import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReadinessResult } from "../../infra/db/wait_for_pg";

vi.mock("../../db", () => ({
  default: {
    queryRow: vi.fn()
  }
}));

describe("Database Readiness Probe", () => {
  let mockDb: any;
  let waitForPostgres: (timeoutMs?: number) => Promise<ReadinessResult>;
  let originalConsoleLog: typeof console.log;

  beforeEach(async () => {
    originalConsoleLog = console.log;
    console.log = vi.fn();
    
    mockDb = (await import("../../db")).default;
    const module = await import("../../infra/db/wait_for_pg");
    waitForPostgres = module.waitForPostgres;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.restoreAllMocks();
  });

  describe("Successful connection scenarios", () => {
    it("should succeed immediately if database is ready", async () => {
      mockDb.queryRow.mockResolvedValueOnce({ ready: 1 });

      const result = await waitForPostgres(5000);

      expect(result.ready).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.elapsedMs).toBeLessThan(100);
      expect(result.error).toBeUndefined();
      expect(mockDb.queryRow).toHaveBeenCalledTimes(1);
    });

    it("should succeed after multiple retries with delayed start", async () => {
      mockDb.queryRow
        .mockRejectedValueOnce(new Error("Connection refused"))
        .mockRejectedValueOnce(new Error("Connection refused"))
        .mockRejectedValueOnce(new Error("Connection refused"))
        .mockResolvedValueOnce({ ready: 1 });

      const result = await waitForPostgres(30000);

      expect(result.ready).toBe(true);
      expect(result.attempts).toBe(4);
      expect(result.error).toBeUndefined();
      expect(mockDb.queryRow).toHaveBeenCalledTimes(4);
    });

    it("should apply exponential backoff with jitter between retries", async () => {
      const startTime = Date.now();
      mockDb.queryRow
        .mockRejectedValueOnce(new Error("Not ready"))
        .mockRejectedValueOnce(new Error("Not ready"))
        .mockResolvedValueOnce({ ready: 1 });

      const result = await waitForPostgres(30000);

      const elapsedMs = Date.now() - startTime;
      
      expect(result.ready).toBe(true);
      expect(result.attempts).toBe(3);
      expect(elapsedMs).toBeGreaterThan(1000);
      expect(elapsedMs).toBeLessThan(10000);
    });
  });

  describe("Failure scenarios", () => {
    it("should fail after max attempts reached", async () => {
      mockDb.queryRow.mockRejectedValue(new Error("Connection refused"));

      const result = await waitForPostgres(300000);

      expect(result.ready).toBe(false);
      expect(result.attempts).toBe(60);
      expect(result.error).toContain("Postgres not ready after 60 attempts");
      expect(mockDb.queryRow).toHaveBeenCalledTimes(60);
    });

    it("should timeout if database never becomes ready within time limit", async () => {
      mockDb.queryRow.mockRejectedValue(new Error("Connection timeout"));

      const shortTimeout = 2000;
      const result = await waitForPostgres(shortTimeout);

      expect(result.ready).toBe(false);
      expect(result.error).toContain("timeout");
      expect(result.elapsedMs).toBeGreaterThanOrEqual(shortTimeout - 100);
      expect(result.elapsedMs).toBeLessThanOrEqual(shortTimeout + 500);
    });

    it("should stop retrying when timeout is exceeded even before max attempts", async () => {
      mockDb.queryRow.mockRejectedValue(new Error("Still starting"));

      const result = await waitForPostgres(1500);

      expect(result.ready).toBe(false);
      expect(result.attempts).toBeLessThan(60);
      expect(result.error).toContain("timeout");
    });

    it("should include last error message in failure result", async () => {
      const errorMessage = "ECONNREFUSED: Connection refused at 127.0.0.1:5432";
      mockDb.queryRow.mockRejectedValue(new Error(errorMessage));

      const result = await waitForPostgres(2000);

      expect(result.ready).toBe(false);
      expect(result.error).toContain(errorMessage);
    });
  });

  describe("Logging behavior", () => {
    it("should log JSON-formatted readiness probe start", async () => {
      mockDb.queryRow.mockResolvedValueOnce({ ready: 1 });

      await waitForPostgres(5000);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Starting Postgres readiness probe"')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
    });

    it("should log retry attempts with backoff details", async () => {
      mockDb.queryRow
        .mockRejectedValueOnce(new Error("Not ready"))
        .mockResolvedValueOnce({ ready: 1 });

      await waitForPostgres(30000);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Postgres not ready, retrying with backoff"')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"level":"warn"')
      );
    });

    it("should log successful connection", async () => {
      mockDb.queryRow.mockResolvedValueOnce({ ready: 1 });

      await waitForPostgres(5000);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Postgres ready"')
      );
    });

    it("should log error on failure with details", async () => {
      mockDb.queryRow.mockRejectedValue(new Error("Fatal error"));

      await waitForPostgres(1500);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"level":"error"')
      );
    });

    it("should not log connection strings or secrets", async () => {
      mockDb.queryRow.mockRejectedValue(
        new Error("Connection failed: postgresql://user:password@host:5432/db")
      );

      await waitForPostgres(1500);

      const logCalls = (console.log as any).mock.calls;
      logCalls.forEach((call: any[]) => {
        expect(call[0]).not.toContain("password");
        if (call[0].includes("connectionString")) {
          expect(call[0]).toContain("[REDACTED]");
        }
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle database becoming available exactly at timeout boundary", async () => {
      let callCount = 0;
      mockDb.queryRow.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("Not ready"));
        }
        return Promise.resolve({ ready: 1 });
      });

      const result = await waitForPostgres(10000);

      expect(result.ready).toBe(true);
    });

    it("should handle different error types gracefully", async () => {
      mockDb.queryRow
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockRejectedValueOnce(new Error("ETIMEDOUT"))
        .mockRejectedValueOnce("String error")
        .mockRejectedValueOnce({ message: "Object error" })
        .mockResolvedValueOnce({ ready: 1 });

      const result = await waitForPostgres(30000);

      expect(result.ready).toBe(true);
      expect(result.attempts).toBe(5);
    });

    it("should handle zero timeout gracefully", async () => {
      mockDb.queryRow.mockResolvedValueOnce({ ready: 1 });

      const result = await waitForPostgres(0);

      expect(result.ready).toBe(false);
      expect(result.error).toContain("timeout");
    });
  });

  describe("Deterministic behavior", () => {
    it("should produce consistent results for same conditions", async () => {
      mockDb.queryRow.mockRejectedValue(new Error("Not ready"));

      const result1 = await waitForPostgres(1000);
      vi.clearAllMocks();
      mockDb.queryRow.mockRejectedValue(new Error("Not ready"));
      const result2 = await waitForPostgres(1000);

      expect(result1.ready).toBe(result2.ready);
      expect(result1.ready).toBe(false);
    });
  });
});
