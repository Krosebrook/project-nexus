/**
 * Unit tests for PolicyEnforcer
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock database before any imports
vi.mock("../db", () => ({
  default: {
    queryRow: vi.fn(),
    exec: vi.fn(),
    query: vi.fn(),
  },
}));

import { PolicyEnforcer, VIOLATION_TYPES } from "./policy-enforcer";
import { ContextWindowValidator } from "./context-validator";
import { RateLimiter } from "./rate-limiter";
import type { AguiRunJob, PolicyConstraints, ToolName } from "./types";

describe("PolicyEnforcer", () => {
  let policyEnforcer: PolicyEnforcer;
  let mockContextValidator: ContextWindowValidator;
  let mockRateLimiter: RateLimiter;

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
    mockContextValidator = new ContextWindowValidator();
    mockRateLimiter = new RateLimiter();

    // Mock rate limiter to avoid cleanup
    mockRateLimiter.stopCleanup();

    policyEnforcer = new PolicyEnforcer(
      mockContextValidator,
      mockRateLimiter
    );
  });

  describe("enforce", () => {
    it("should allow request when all checks pass", async () => {
      const job = createMockJob();
      const policy = createMockPolicy();

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.violationType).toBeUndefined();
    });

    it("should reject when recursion depth exceeded", async () => {
      const job = createMockJob({ currentDepth: 5 });
      const policy = createMockPolicy({ maxRecursionDepth: 5 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.violationType).toBe(VIOLATION_TYPES.RECURSION_DEPTH);
      expect(result.reason).toContain("Recursion depth limit exceeded");
    });

    it("should reject when context window exceeded", async () => {
      const job = createMockJob({ prompt: "a".repeat(40000) }); // ~10000 tokens
      const policy = createMockPolicy({ contextWindowLimit: 1000 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.violationType).toBe(VIOLATION_TYPES.CONTEXT_WINDOW);
      expect(result.reason).toContain("Context window");
    });

    it("should reject when rate limit exceeded", async () => {
      const job = createMockJob();
      const policy = createMockPolicy({
        rateLimit: { requestsPerMinute: 2, requestsPerHour: 100 },
      });

      // Exceed rate limit
      await mockRateLimiter.incrementCounter("user-123");
      await mockRateLimiter.incrementCounter("user-123");

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.violationType).toBe(VIOLATION_TYPES.RATE_LIMIT);
      expect(result.reason).toContain("Rate limit exceeded");
    });

    it("should reject when tool calls exceeded", async () => {
      const toolResults = Array(10)
        .fill(null)
        .map((_, i) => ({
          toolName: "google_search" as ToolName,
          result: `result-${i}`,
        }));

      const job = createMockJob({ toolResults });
      const policy = createMockPolicy({ maxToolCalls: 10 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.violationType).toBe(VIOLATION_TYPES.TOOL_CALLS_EXCEEDED);
      expect(result.reason).toContain("Tool calls limit exceeded");
    });

    it("should reject when tool not in allowlist", async () => {
      const toolResults = [
        {
          toolName: "code_executor" as ToolName,
          result: "result",
        },
      ];

      const job = createMockJob({ toolResults });
      const policy = createMockPolicy({
        allowedTools: ["google_search", "workflow_orchestrator"],
      });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.violationType).toBe(VIOLATION_TYPES.TOOL_NOT_ALLOWED);
      expect(result.reason).toContain("Tool not allowed");
      expect(result.reason).toContain("code_executor");
    });

    it("should handle errors gracefully", async () => {
      // Create invalid job that will cause error
      const job = createMockJob();
      const policy = null as any; // Invalid policy

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.violationType).toBe("INTERNAL_ERROR");
      expect(result.reason).toBe("Policy enforcement failed");
    });
  });

  describe("recursion depth check", () => {
    it("should allow when depth is below limit", async () => {
      const job = createMockJob({ currentDepth: 3 });
      const policy = createMockPolicy({ maxRecursionDepth: 5 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });

    it("should reject when depth equals limit", async () => {
      const job = createMockJob({ currentDepth: 5 });
      const policy = createMockPolicy({ maxRecursionDepth: 5 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.details?.currentDepth).toBe(5);
      expect(result.details?.maxDepth).toBe(5);
    });

    it("should reject when depth exceeds limit", async () => {
      const job = createMockJob({ currentDepth: 10 });
      const policy = createMockPolicy({ maxRecursionDepth: 5 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
    });

    it("should handle undefined currentDepth as 0", async () => {
      const job = createMockJob({ currentDepth: undefined });
      const policy = createMockPolicy({ maxRecursionDepth: 5 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });
  });

  describe("context window check", () => {
    it("should allow when context is within limit", async () => {
      const job = createMockJob({ prompt: "Hello, world!" });
      const policy = createMockPolicy({ contextWindowLimit: 8000 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });

    it("should reject when prompt exceeds limit", async () => {
      const job = createMockJob({ prompt: "a".repeat(40000) });
      const policy = createMockPolicy({ contextWindowLimit: 1000 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.details?.estimated).toBeGreaterThan(0);
      expect(result.details?.limit).toBe(1000);
    });

    it("should include previous context in validation", async () => {
      const job = createMockJob({
        prompt: "a".repeat(2000),
        previousContext: "b".repeat(2000),
      });
      const policy = createMockPolicy({ contextWindowLimit: 1000 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
    });

    it("should handle empty prompt", async () => {
      const job = createMockJob({ prompt: "" });
      const policy = createMockPolicy({ contextWindowLimit: 8000 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });
  });

  describe("rate limit check", () => {
    it("should allow within rate limits", async () => {
      const job = createMockJob();
      const policy = createMockPolicy({
        rateLimit: { requestsPerMinute: 10, requestsPerHour: 100 },
      });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });

    it("should reject when minute limit exceeded", async () => {
      const job = createMockJob();
      const policy = createMockPolicy({
        rateLimit: { requestsPerMinute: 2, requestsPerHour: 100 },
      });

      // Hit the limit
      await mockRateLimiter.incrementCounter("user-123");
      await mockRateLimiter.incrementCounter("user-123");

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.violationType).toBe(VIOLATION_TYPES.RATE_LIMIT);
    });

    it("should reject when hour limit exceeded", async () => {
      const job = createMockJob();
      const policy = createMockPolicy({
        rateLimit: { requestsPerMinute: 100, requestsPerHour: 2 },
      });

      // Hit the limit
      await mockRateLimiter.incrementCounter("user-123");
      await mockRateLimiter.incrementCounter("user-123");

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
    });

    it("should track different users separately", async () => {
      const job1 = createMockJob({ userId: "user-1" });
      const job2 = createMockJob({ userId: "user-2" });
      const policy = createMockPolicy({
        rateLimit: { requestsPerMinute: 2, requestsPerHour: 100 },
      });

      // User 1 hits limit
      await mockRateLimiter.incrementCounter("user-1");
      await mockRateLimiter.incrementCounter("user-1");

      const result1 = await policyEnforcer.enforce(job1, policy);
      const result2 = await policyEnforcer.enforce(job2, policy);

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });

  describe("tool calls count check", () => {
    it("should allow when tool calls are below limit", async () => {
      const toolResults = [
        { toolName: "google_search" as ToolName, result: "result" },
      ];

      const job = createMockJob({ toolResults });
      const policy = createMockPolicy({ maxToolCalls: 10 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });

    it("should reject when tool calls equal limit", async () => {
      const toolResults = Array(10)
        .fill(null)
        .map(() => ({
          toolName: "google_search" as ToolName,
          result: "result",
        }));

      const job = createMockJob({ toolResults });
      const policy = createMockPolicy({ maxToolCalls: 10 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.details?.toolCallsCount).toBe(10);
      expect(result.details?.maxToolCalls).toBe(10);
    });

    it("should allow when no tool results", async () => {
      const job = createMockJob({ toolResults: undefined });
      const policy = createMockPolicy({ maxToolCalls: 10 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });

    it("should allow empty tool results array", async () => {
      const job = createMockJob({ toolResults: [] });
      const policy = createMockPolicy({ maxToolCalls: 10 });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });
  });

  describe("tool allowlist check", () => {
    it("should allow all tools when allowlist is empty", async () => {
      const toolResults = [
        { toolName: "google_search" as ToolName, result: "result" },
        { toolName: "code_executor" as ToolName, result: "result" },
      ];

      const job = createMockJob({ toolResults });
      const policy = createMockPolicy({ allowedTools: [] });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });

    it("should allow when tool is in allowlist", async () => {
      const toolResults = [
        { toolName: "google_search" as ToolName, result: "result" },
      ];

      const job = createMockJob({ toolResults });
      const policy = createMockPolicy({
        allowedTools: ["google_search", "workflow_orchestrator"],
      });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });

    it("should reject when tool not in allowlist", async () => {
      const toolResults = [
        { toolName: "code_executor" as ToolName, result: "result" },
      ];

      const job = createMockJob({ toolResults });
      const policy = createMockPolicy({
        allowedTools: ["google_search"],
      });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.details?.disallowedTools).toContain("code_executor");
      expect(result.details?.allowedTools).toContain("google_search");
    });

    it("should reject when multiple tools not in allowlist", async () => {
      const toolResults = [
        { toolName: "code_executor" as ToolName, result: "result" },
        { toolName: "submit_parallel_job" as ToolName, result: "result" },
      ];

      const job = createMockJob({ toolResults });
      const policy = createMockPolicy({
        allowedTools: ["google_search"],
      });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("code_executor");
      expect(result.reason).toContain("submit_parallel_job");
    });

    it("should allow when no tool results and allowlist specified", async () => {
      const job = createMockJob({ toolResults: [] });
      const policy = createMockPolicy({
        allowedTools: ["google_search"],
      });

      const result = await policyEnforcer.enforce(job, policy);

      expect(result.allowed).toBe(true);
    });
  });

  describe("VIOLATION_TYPES", () => {
    it("should have all violation types defined", () => {
      expect(VIOLATION_TYPES.RECURSION_DEPTH).toBe("RECURSION_DEPTH_EXCEEDED");
      expect(VIOLATION_TYPES.CONTEXT_WINDOW).toBe("CONTEXT_WINDOW_EXCEEDED");
      expect(VIOLATION_TYPES.RATE_LIMIT).toBe("RATE_LIMIT_EXCEEDED");
      expect(VIOLATION_TYPES.TOOL_NOT_ALLOWED).toBe("TOOL_NOT_ALLOWED");
      expect(VIOLATION_TYPES.TOOL_CALLS_EXCEEDED).toBe("TOOL_CALLS_EXCEEDED");
    });
  });
});
