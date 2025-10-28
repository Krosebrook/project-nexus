/**
 * Tests for idempotency mechanism
 */
import { describe, it, expect } from "vitest";
import {
  calculateIntentSignature,
  haveSameIntent,
  isValidSignature,
  getShortSignature,
  extractStableParameters,
} from "./idempotency";
import type { AguiRunJob } from "./types";

describe("Idempotency Mechanism", () => {
  const baseJob: AguiRunJob = {
    userId: "user123",
    prompt: "What is the meaning of life?",
    correlationId: "550e8400-e29b-41d4-a716-446655440000",
    maxDepth: 5,
    contextWindowLimit: 8000,
    currentDepth: 0,
  };

  describe("calculateIntentSignature", () => {
    it("should produce a valid SHA256 hash (64 hex characters)", () => {
      const signature = calculateIntentSignature(baseJob);
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce the same signature for identical stable parameters", () => {
      const job1 = { ...baseJob, correlationId: "id-1", currentDepth: 0 };
      const job2 = { ...baseJob, correlationId: "id-2", currentDepth: 1 };

      const sig1 = calculateIntentSignature(job1);
      const sig2 = calculateIntentSignature(job2);

      expect(sig1).toBe(sig2);
    });

    it("should produce different signatures for different prompts", () => {
      const job1 = { ...baseJob, prompt: "Hello" };
      const job2 = { ...baseJob, prompt: "World" };

      const sig1 = calculateIntentSignature(job1);
      const sig2 = calculateIntentSignature(job2);

      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different users", () => {
      const job1 = { ...baseJob, userId: "user1" };
      const job2 = { ...baseJob, userId: "user2" };

      const sig1 = calculateIntentSignature(job1);
      const sig2 = calculateIntentSignature(job2);

      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different maxDepth", () => {
      const job1 = { ...baseJob, maxDepth: 5 };
      const job2 = { ...baseJob, maxDepth: 10 };

      const sig1 = calculateIntentSignature(job1);
      const sig2 = calculateIntentSignature(job2);

      expect(sig1).not.toBe(sig2);
    });

    it("should handle optional fields consistently", () => {
      const job1 = { ...baseJob };
      const job2 = { ...baseJob, metadata: { key: "value" } };

      const sig1 = calculateIntentSignature(job1);
      const sig2 = calculateIntentSignature(job2);

      expect(sig1).not.toBe(sig2);
    });

    it("should produce deterministic signatures", () => {
      const sig1 = calculateIntentSignature(baseJob);
      const sig2 = calculateIntentSignature(baseJob);
      const sig3 = calculateIntentSignature(baseJob);

      expect(sig1).toBe(sig2);
      expect(sig2).toBe(sig3);
    });
  });

  describe("extractStableParameters", () => {
    it("should exclude volatile parameters", () => {
      const stable = extractStableParameters(baseJob);

      expect(stable).not.toHaveProperty("correlationId");
      expect(stable).not.toHaveProperty("currentDepth");
    });

    it("should include stable parameters", () => {
      const stable = extractStableParameters(baseJob);

      expect(stable).toHaveProperty("userId");
      expect(stable).toHaveProperty("prompt");
      expect(stable).toHaveProperty("maxDepth");
      expect(stable).toHaveProperty("contextWindowLimit");
    });

    it("should handle default values", () => {
      const jobWithDefaults: AguiRunJob = {
        userId: "user123",
        prompt: "Test",
        correlationId: "id",
      };

      const stable = extractStableParameters(jobWithDefaults);

      expect(stable.maxDepth).toBe(5);
      expect(stable.contextWindowLimit).toBe(8000);
    });
  });

  describe("haveSameIntent", () => {
    it("should return true for jobs with same intent", () => {
      const job1 = { ...baseJob, correlationId: "id-1" };
      const job2 = { ...baseJob, correlationId: "id-2" };

      expect(haveSameIntent(job1, job2)).toBe(true);
    });

    it("should return false for jobs with different prompts", () => {
      const job1 = { ...baseJob, prompt: "A" };
      const job2 = { ...baseJob, prompt: "B" };

      expect(haveSameIntent(job1, job2)).toBe(false);
    });
  });

  describe("isValidSignature", () => {
    it("should validate correct SHA256 signatures", () => {
      const validSig = "a".repeat(64);
      expect(isValidSignature(validSig)).toBe(true);
    });

    it("should reject invalid signatures", () => {
      expect(isValidSignature("")).toBe(false);
      expect(isValidSignature("abc")).toBe(false);
      expect(isValidSignature("g".repeat(64))).toBe(false); // Invalid hex
      expect(isValidSignature("a".repeat(63))).toBe(false); // Too short
      expect(isValidSignature("a".repeat(65))).toBe(false); // Too long
    });
  });

  describe("getShortSignature", () => {
    it("should return first 8 characters", () => {
      const sig = "abcdef1234567890" + "x".repeat(48);
      const short = getShortSignature(sig);

      expect(short).toBe("abcdef12");
      expect(short.length).toBe(8);
    });
  });

  describe("Normalization edge cases", () => {
    it("should handle nested objects consistently", () => {
      const job1 = {
        ...baseJob,
        metadata: { a: 1, b: { c: 2, d: 3 } },
      };
      const job2 = {
        ...baseJob,
        metadata: { b: { d: 3, c: 2 }, a: 1 }, // Different order
      };

      const sig1 = calculateIntentSignature(job1);
      const sig2 = calculateIntentSignature(job2);

      expect(sig1).toBe(sig2); // Should normalize object key order
    });

    it("should handle arrays consistently", () => {
      const job1 = {
        ...baseJob,
        toolResults: [
          { toolName: "google_search" as const, result: "A" },
          { toolName: "code_executor" as const, result: "B" },
        ],
      };
      const job2 = { ...baseJob, toolResults: [...job1.toolResults] };

      const sig1 = calculateIntentSignature(job1);
      const sig2 = calculateIntentSignature(job2);

      expect(sig1).toBe(sig2);
    });

    it("should handle undefined vs missing fields consistently", () => {
      const job1 = { ...baseJob };
      const job2 = { ...baseJob, previousContext: undefined };

      const sig1 = calculateIntentSignature(job1);
      const sig2 = calculateIntentSignature(job2);

      expect(sig1).toBe(sig2);
    });
  });
});
