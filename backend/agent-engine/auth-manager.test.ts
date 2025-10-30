/**
 * Unit tests for AuthManager
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AuthManager, DEFAULT_POLICIES, AUTH_CONFIG } from "./auth-manager";
import type { UserTier } from "./types";

// Mock database
vi.mock("../db", () => ({
  default: {
    queryRow: vi.fn(),
    exec: vi.fn(),
    query: vi.fn(),
  },
}));

import database from "../db";

describe("AuthManager", () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUserPolicy", () => {
    it("should return policy from database if user exists", async () => {
      const mockRow = {
        user_id: "user-123",
        tier: "pro",
        max_recursion_depth: 10,
        context_window_limit: 16000,
        max_tool_calls: 25,
        allowed_tools: [],
        requests_per_minute: 30,
        requests_per_hour: 500,
      };

      vi.mocked(database.queryRow).mockResolvedValueOnce(mockRow);

      const policy = await authManager.getUserPolicy("user-123");

      expect(policy).toEqual({
        maxRecursionDepth: 10,
        contextWindowLimit: 16000,
        maxToolCalls: 25,
        allowedTools: [],
        rateLimit: {
          requestsPerMinute: 30,
          requestsPerHour: 500,
        },
      });

      expect(database.queryRow).toHaveBeenCalledTimes(1);
    });

    it("should create default policy if user not found", async () => {
      vi.mocked(database.queryRow).mockResolvedValueOnce(null);
      vi.mocked(database.exec).mockResolvedValueOnce(undefined);

      const policy = await authManager.getUserPolicy("user-new");

      expect(policy).toEqual(DEFAULT_POLICIES.free);
      expect(database.exec).toHaveBeenCalledTimes(1);
    });

    it("should handle allowed_tools as array", async () => {
      const mockRow = {
        user_id: "user-123",
        tier: "enterprise",
        max_recursion_depth: 20,
        context_window_limit: 128000,
        max_tool_calls: 100,
        allowed_tools: ["google_search", "code_executor"],
        requests_per_minute: 100,
        requests_per_hour: 2000,
      };

      vi.mocked(database.queryRow).mockResolvedValueOnce(mockRow);

      const policy = await authManager.getUserPolicy("user-123");

      expect(policy.allowedTools).toEqual(["google_search", "code_executor"]);
    });

    it("should fallback to free tier on error", async () => {
      vi.mocked(database.queryRow).mockRejectedValueOnce(
        new Error("Database error")
      );

      const policy = await authManager.getUserPolicy("user-error");

      expect(policy).toEqual(DEFAULT_POLICIES.free);
    });
  });

  describe("createDefaultPolicy", () => {
    it("should create free tier policy", async () => {
      vi.mocked(database.exec).mockResolvedValueOnce(undefined);

      await authManager.createDefaultPolicy("user-123", "free");

      expect(database.exec).toHaveBeenCalledTimes(1);
      // Database template literal is an array
      expect(database.exec).toHaveBeenCalled();
    });

    it("should create pro tier policy", async () => {
      vi.mocked(database.exec).mockResolvedValueOnce(undefined);

      await authManager.createDefaultPolicy("user-456", "pro");

      expect(database.exec).toHaveBeenCalledTimes(1);
    });

    it("should create enterprise tier policy", async () => {
      vi.mocked(database.exec).mockResolvedValueOnce(undefined);

      await authManager.createDefaultPolicy("user-789", "enterprise");

      expect(database.exec).toHaveBeenCalledTimes(1);
    });

    it("should handle ON CONFLICT gracefully", async () => {
      vi.mocked(database.exec).mockResolvedValueOnce(undefined);

      await authManager.createDefaultPolicy("user-existing", "free");

      expect(database.exec).toHaveBeenCalledTimes(1);
    });

    it("should throw error on database failure", async () => {
      vi.mocked(database.exec).mockRejectedValueOnce(
        new Error("Database error")
      );

      await expect(
        authManager.createDefaultPolicy("user-error", "free")
      ).rejects.toThrow("Database error");
    });
  });

  describe("updateUserTier", () => {
    it("should update existing user tier", async () => {
      vi.mocked(database.exec).mockResolvedValueOnce(undefined);
      vi.mocked(database.queryRow).mockResolvedValueOnce({ count: 1 });

      await authManager.updateUserTier("user-123", "pro");

      expect(database.exec).toHaveBeenCalledTimes(1);
      // Database template literal is an array
      expect(database.exec).toHaveBeenCalled();
    });

    it("should create policy if user does not exist", async () => {
      vi.mocked(database.exec).mockResolvedValueOnce(undefined);
      vi.mocked(database.queryRow).mockResolvedValueOnce({ count: 0 });
      vi.mocked(database.exec).mockResolvedValueOnce(undefined);

      await authManager.updateUserTier("user-new", "enterprise");

      expect(database.exec).toHaveBeenCalledTimes(2);
    });

    it("should validate tier before updating", async () => {
      await expect(
        authManager.updateUserTier("user-123", "invalid-tier" as UserTier)
      ).rejects.toThrow();
    });

    it("should handle database errors", async () => {
      vi.mocked(database.exec).mockRejectedValueOnce(
        new Error("Database error")
      );

      await expect(
        authManager.updateUserTier("user-error", "pro")
      ).rejects.toThrow("Database error");
    });
  });

  describe("getUserTier", () => {
    it("should return user tier from database", async () => {
      vi.mocked(database.queryRow).mockResolvedValueOnce({ tier: "pro" });

      const tier = await authManager.getUserTier("user-123");

      expect(tier).toBe("pro");
      expect(database.queryRow).toHaveBeenCalledTimes(1);
    });

    it("should return default tier if user not found", async () => {
      vi.mocked(database.queryRow).mockResolvedValueOnce(null);

      const tier = await authManager.getUserTier("user-new");

      expect(tier).toBe(AUTH_CONFIG.DEFAULT_TIER);
    });

    it("should return default tier on error", async () => {
      vi.mocked(database.queryRow).mockRejectedValueOnce(
        new Error("Database error")
      );

      const tier = await authManager.getUserTier("user-error");

      expect(tier).toBe(AUTH_CONFIG.DEFAULT_TIER);
    });

    it("should validate tier from database", async () => {
      vi.mocked(database.queryRow).mockResolvedValueOnce({
        tier: "enterprise",
      });

      const tier = await authManager.getUserTier("user-123");

      expect(tier).toBe("enterprise");
    });
  });

  describe("DEFAULT_POLICIES", () => {
    it("should have correct free tier limits", () => {
      expect(DEFAULT_POLICIES.free).toEqual({
        maxRecursionDepth: 5,
        contextWindowLimit: 8000,
        maxToolCalls: 10,
        allowedTools: [],
        rateLimit: {
          requestsPerMinute: 10,
          requestsPerHour: 100,
        },
      });
    });

    it("should have correct pro tier limits", () => {
      expect(DEFAULT_POLICIES.pro).toEqual({
        maxRecursionDepth: 10,
        contextWindowLimit: 16000,
        maxToolCalls: 25,
        allowedTools: [],
        rateLimit: {
          requestsPerMinute: 30,
          requestsPerHour: 500,
        },
      });
    });

    it("should have correct enterprise tier limits", () => {
      expect(DEFAULT_POLICIES.enterprise).toEqual({
        maxRecursionDepth: 20,
        contextWindowLimit: 128000,
        maxToolCalls: 100,
        allowedTools: [],
        rateLimit: {
          requestsPerMinute: 100,
          requestsPerHour: 2000,
        },
      });
    });

    it("should have increasing limits across tiers", () => {
      expect(DEFAULT_POLICIES.free.maxRecursionDepth).toBeLessThan(
        DEFAULT_POLICIES.pro.maxRecursionDepth
      );
      expect(DEFAULT_POLICIES.pro.maxRecursionDepth).toBeLessThan(
        DEFAULT_POLICIES.enterprise.maxRecursionDepth
      );

      expect(DEFAULT_POLICIES.free.contextWindowLimit).toBeLessThan(
        DEFAULT_POLICIES.pro.contextWindowLimit
      );
      expect(DEFAULT_POLICIES.pro.contextWindowLimit).toBeLessThan(
        DEFAULT_POLICIES.enterprise.contextWindowLimit
      );
    });
  });
});
