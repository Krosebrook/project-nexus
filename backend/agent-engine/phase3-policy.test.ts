/**
 * Unit tests for Phase3Policy
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock database before any imports
vi.mock("../db", () => ({
  default: {
    queryRow: vi.fn(),
    exec: vi.fn(),
    query: vi.fn(),
  },
}));

// Mock all dependencies
vi.mock("./auth-manager");
vi.mock("./context-validator");
vi.mock("./rate-limiter");
vi.mock("./policy-enforcer");
vi.mock("./audit-logger");

import { Phase3Policy, PHASE3_CONFIG } from "./phase3-policy";
import { AuthManager } from "./auth-manager";
import { ContextWindowValidator } from "./context-validator";
import { RateLimiter } from "./rate-limiter";
import { PolicyEnforcer } from "./policy-enforcer";
import { AuditLogger } from "./audit-logger";
import type { AguiRunJob, PolicyConstraints } from "./types";

describe("Phase3Policy", () => {
  let phase3Policy: Phase3Policy;
  let mockAuthManager: AuthManager;
  let mockContextValidator: ContextWindowValidator;
  let mockRateLimiter: RateLimiter;
  let mockPolicyEnforcer: PolicyEnforcer;
  let mockAuditLogger: AuditLogger;

  const createMockJob = (overrides?: Partial<AguiRunJob>): AguiRunJob => ({
    userId: "user-123",
    prompt: "Test prompt",
    correlationId: "corr-123",
    maxDepth: 5,
    currentDepth: 0,
    contextWindowLimit: 8000,
    ...overrides,
  });

  const createMockPolicy = (
    overrides?: Partial<PolicyConstraints>
  ): PolicyConstraints => ({
    maxRecursionDepth: 5,
    contextWindowLimit: 8000,
    maxToolCalls: 10,
    allowedTools: [],
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
    },
    ...overrides,
  });

  beforeEach(() => {
    // Create mock instances
    mockAuthManager = new AuthManager();
    mockContextValidator = new ContextWindowValidator();
    mockRateLimiter = new RateLimiter();
    mockPolicyEnforcer = new PolicyEnforcer();
    mockAuditLogger = new AuditLogger();

    // Setup default mock implementations
    vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(
      createMockPolicy()
    );
    vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
      allowed: true,
    });
    vi.mocked(mockRateLimiter.incrementCounter).mockResolvedValue(undefined);
    vi.mocked(mockAuditLogger.log).mockResolvedValue(undefined);

    phase3Policy = new Phase3Policy(
      mockAuthManager,
      mockContextValidator,
      mockRateLimiter,
      mockPolicyEnforcer,
      mockAuditLogger
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should return CONTINUE when all checks pass", async () => {
      const job = createMockJob();

      const result = await phase3Policy.execute(job);

      expect(result.phaseResult).toBe("CONTINUE");
      expect(result.policy).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should retrieve user policy", async () => {
      const job = createMockJob();

      await phase3Policy.execute(job);

      expect(mockAuthManager.getUserPolicy).toHaveBeenCalledWith("user-123");
    });

    it("should enforce policy constraints", async () => {
      const job = createMockJob();
      const mockPolicy = createMockPolicy();

      vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(mockPolicy);

      await phase3Policy.execute(job);

      expect(mockPolicyEnforcer.enforce).toHaveBeenCalledWith(job, mockPolicy);
    });

    it("should increment rate limit counter on success", async () => {
      const job = createMockJob();

      await phase3Policy.execute(job);

      expect(mockRateLimiter.incrementCounter).toHaveBeenCalledWith("user-123");
    });

    it("should log audit events", async () => {
      const job = createMockJob();

      await phase3Policy.execute(job);

      // Should log: PHASE_STARTED, POLICY_RETRIEVED, POLICY_CHECKS_PASSED
      expect(mockAuditLogger.log).toHaveBeenCalledTimes(3);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "PHASE_STARTED",
        })
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "POLICY_RETRIEVED",
        })
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "POLICY_CHECKS_PASSED",
        })
      );
    });

    it("should return POLICY_VIOLATION when enforcement fails", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        reason: "Recursion depth exceeded",
        violationType: "RECURSION_DEPTH_EXCEEDED",
        details: { currentDepth: 5, maxDepth: 5 },
      });

      const result = await phase3Policy.execute(job);

      expect(result.phaseResult).toBe("POLICY_VIOLATION");
      expect(result.error).toBeDefined();
      expect(result.error?.code).toContain("PHASE3");
      expect(result.error?.message).toContain("Recursion depth exceeded");
    });

    it("should log policy violation audit event", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        reason: "Rate limit exceeded",
        violationType: "RATE_LIMIT_EXCEEDED",
      });

      await phase3Policy.execute(job);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "POLICY_VIOLATION",
          details: expect.objectContaining({
            violationType: "RATE_LIMIT_EXCEEDED",
            reason: "Rate limit exceeded",
          }),
        })
      );
    });

    it("should not increment counter when enforcement fails", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        reason: "Policy violation",
      });

      await phase3Policy.execute(job);

      expect(mockRateLimiter.incrementCounter).not.toHaveBeenCalled();
    });

    it("should return ERROR on unexpected exception", async () => {
      const job = createMockJob();

      vi.mocked(mockAuthManager.getUserPolicy).mockRejectedValue(
        new Error("Database error")
      );

      const result = await phase3Policy.execute(job);

      expect(result.phaseResult).toBe("ERROR");
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(PHASE3_CONFIG.ERROR_CODES.UNKNOWN_ERROR);
      expect(result.error?.message).toContain("Database error");
    });

    it("should log phase error on exception", async () => {
      const job = createMockJob();

      vi.mocked(mockAuthManager.getUserPolicy).mockRejectedValue(
        new Error("Test error")
      );

      await phase3Policy.execute(job);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "PHASE_ERROR",
          details: expect.objectContaining({
            error: "Test error",
          }),
        })
      );
    });
  });

  describe("policy override", () => {
    it("should override maxDepth with job-specific value if lower", async () => {
      const job = createMockJob({ maxDepth: 3 });
      const mockPolicy = createMockPolicy({ maxRecursionDepth: 10 });

      vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(mockPolicy);

      await phase3Policy.execute(job);

      expect(mockPolicyEnforcer.enforce).toHaveBeenCalledWith(
        job,
        expect.objectContaining({ maxRecursionDepth: 3 })
      );
    });

    it("should not override maxDepth if job value is higher", async () => {
      const job = createMockJob({ maxDepth: 20 });
      const mockPolicy = createMockPolicy({ maxRecursionDepth: 10 });

      vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(mockPolicy);

      await phase3Policy.execute(job);

      expect(mockPolicyEnforcer.enforce).toHaveBeenCalledWith(
        job,
        expect.objectContaining({ maxRecursionDepth: 10 })
      );
    });

    it("should override contextWindowLimit if job value is lower", async () => {
      const job = createMockJob({ contextWindowLimit: 4000 });
      const mockPolicy = createMockPolicy({ contextWindowLimit: 8000 });

      vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(mockPolicy);

      await phase3Policy.execute(job);

      expect(mockPolicyEnforcer.enforce).toHaveBeenCalledWith(
        job,
        expect.objectContaining({ contextWindowLimit: 4000 })
      );
    });

    it("should not override contextWindowLimit if job value is higher", async () => {
      const job = createMockJob({ contextWindowLimit: 16000 });
      const mockPolicy = createMockPolicy({ contextWindowLimit: 8000 });

      vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(mockPolicy);

      await phase3Policy.execute(job);

      expect(mockPolicyEnforcer.enforce).toHaveBeenCalledWith(
        job,
        expect.objectContaining({ contextWindowLimit: 8000 })
      );
    });

    it("should handle undefined job limits", async () => {
      const job = createMockJob({ maxDepth: undefined, contextWindowLimit: undefined });
      const mockPolicy = createMockPolicy();

      vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(mockPolicy);

      await phase3Policy.execute(job);

      expect(mockPolicyEnforcer.enforce).toHaveBeenCalledWith(job, mockPolicy);
    });
  });

  describe("error code mapping", () => {
    it("should map RATE_LIMIT_EXCEEDED to correct error code", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        violationType: "RATE_LIMIT_EXCEEDED",
        reason: "Rate limit exceeded",
      });

      const result = await phase3Policy.execute(job);

      expect(result.error?.code).toBe(
        PHASE3_CONFIG.ERROR_CODES.RATE_LIMIT_EXCEEDED
      );
    });

    it("should map CONTEXT_WINDOW_EXCEEDED to correct error code", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        violationType: "CONTEXT_WINDOW_EXCEEDED",
        reason: "Context exceeded",
      });

      const result = await phase3Policy.execute(job);

      expect(result.error?.code).toBe(
        PHASE3_CONFIG.ERROR_CODES.CONTEXT_EXCEEDED
      );
    });

    it("should map RECURSION_DEPTH_EXCEEDED to correct error code", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        violationType: "RECURSION_DEPTH_EXCEEDED",
        reason: "Recursion exceeded",
      });

      const result = await phase3Policy.execute(job);

      expect(result.error?.code).toBe(
        PHASE3_CONFIG.ERROR_CODES.RECURSION_EXCEEDED
      );
    });

    it("should use generic POLICY_VIOLATION for unknown types", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        violationType: "UNKNOWN_TYPE",
        reason: "Unknown violation",
      });

      const result = await phase3Policy.execute(job);

      expect(result.error?.code).toBe(
        PHASE3_CONFIG.ERROR_CODES.POLICY_VIOLATION
      );
    });

    it("should handle undefined violation type", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        reason: "Violation",
      });

      const result = await phase3Policy.execute(job);

      expect(result.error?.code).toBe(
        PHASE3_CONFIG.ERROR_CODES.POLICY_VIOLATION
      );
    });
  });

  describe("audit logging", () => {
    it("should include correlation ID in all logs", async () => {
      const job = createMockJob({ correlationId: "test-corr-123" });

      await phase3Policy.execute(job);

      const calls = vi.mocked(mockAuditLogger.log).mock.calls;
      calls.forEach((call) => {
        expect(call[0].correlationId).toBe("test-corr-123");
      });
    });

    it("should include user ID in all logs", async () => {
      const job = createMockJob({ userId: "test-user-456" });

      await phase3Policy.execute(job);

      const calls = vi.mocked(mockAuditLogger.log).mock.calls;
      calls.forEach((call) => {
        expect(call[0].userId).toBe("test-user-456");
      });
    });

    it("should include phase name in all logs", async () => {
      const job = createMockJob();

      await phase3Policy.execute(job);

      const calls = vi.mocked(mockAuditLogger.log).mock.calls;
      calls.forEach((call) => {
        expect(call[0].phase).toBe(PHASE3_CONFIG.PHASE_NAME);
      });
    });

    it("should log policy details on retrieval", async () => {
      // Use job with no limits so policy defaults are used
      const job = createMockJob({ maxDepth: undefined, contextWindowLimit: undefined });
      const mockPolicy = createMockPolicy({
        maxRecursionDepth: 10,
        contextWindowLimit: 16000,
      });

      vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(mockPolicy);

      await phase3Policy.execute(job);

      // Find the POLICY_RETRIEVED call in the audit log calls
      const calls = vi.mocked(mockAuditLogger.log).mock.calls;
      const policyRetrievedCall = calls.find(
        (call) => call[0].event === "POLICY_RETRIEVED"
      );

      expect(policyRetrievedCall).toBeDefined();
      expect(policyRetrievedCall![0].details).toMatchObject({
        maxRecursionDepth: 10,
        contextWindowLimit: 16000,
      });
    });

    it("should log violation details on policy violation", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        violationType: "RECURSION_DEPTH_EXCEEDED",
        reason: "Depth exceeded",
        details: { currentDepth: 10, maxDepth: 5 },
      });

      await phase3Policy.execute(job);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "POLICY_VIOLATION",
          details: expect.objectContaining({
            violationType: "RECURSION_DEPTH_EXCEEDED",
            reason: "Depth exceeded",
            details: { currentDepth: 10, maxDepth: 5 },
          }),
        })
      );
    });
  });

  describe("PHASE3_CONFIG", () => {
    it("should have correct phase name", () => {
      expect(PHASE3_CONFIG.PHASE_NAME).toBe("POLICY_ENFORCEMENT");
    });

    it("should have all error codes defined", () => {
      expect(PHASE3_CONFIG.ERROR_CODES.POLICY_VIOLATION).toBeDefined();
      expect(PHASE3_CONFIG.ERROR_CODES.RATE_LIMIT_EXCEEDED).toBeDefined();
      expect(PHASE3_CONFIG.ERROR_CODES.CONTEXT_EXCEEDED).toBeDefined();
      expect(PHASE3_CONFIG.ERROR_CODES.RECURSION_EXCEEDED).toBeDefined();
      expect(PHASE3_CONFIG.ERROR_CODES.UNKNOWN_ERROR).toBeDefined();
    });

    it("should have error codes starting with PHASE3", () => {
      Object.values(PHASE3_CONFIG.ERROR_CODES).forEach((code) => {
        expect(code).toContain("PHASE3");
      });
    });
  });

  describe("integration", () => {
    it("should handle complete successful flow", async () => {
      const job = createMockJob({
        userId: "user-integration",
        correlationId: "corr-integration",
        currentDepth: 2,
      });

      const mockPolicy = createMockPolicy({
        maxRecursionDepth: 10,
        contextWindowLimit: 16000,
        maxToolCalls: 25,
      });

      vi.mocked(mockAuthManager.getUserPolicy).mockResolvedValue(mockPolicy);
      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: true,
      });

      const result = await phase3Policy.execute(job);

      expect(result.phaseResult).toBe("CONTINUE");
      expect(result.policy).toEqual(mockPolicy);
      expect(result.error).toBeUndefined();

      // Verify all components were called
      expect(mockAuthManager.getUserPolicy).toHaveBeenCalled();
      expect(mockPolicyEnforcer.enforce).toHaveBeenCalled();
      expect(mockRateLimiter.incrementCounter).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledTimes(3);
    });

    it("should handle complete violation flow", async () => {
      const job = createMockJob();

      vi.mocked(mockPolicyEnforcer.enforce).mockResolvedValue({
        allowed: false,
        violationType: "RATE_LIMIT_EXCEEDED",
        reason: "Too many requests",
        details: { remaining: { perMinute: 0, perHour: 0 } },
      });

      const result = await phase3Policy.execute(job);

      expect(result.phaseResult).toBe("POLICY_VIOLATION");
      expect(result.error?.code).toBe(
        PHASE3_CONFIG.ERROR_CODES.RATE_LIMIT_EXCEEDED
      );
      expect(result.error?.message).toContain("Too many requests");

      // Should not increment counter on violation
      expect(mockRateLimiter.incrementCounter).not.toHaveBeenCalled();

      // Should log violation
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "POLICY_VIOLATION",
        })
      );
    });
  });
});
