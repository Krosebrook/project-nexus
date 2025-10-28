/**
 * Tests for ResilientLLMClient
 * Verifies retry logic and exponential backoff timing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "vitest";
import { ResilientLLMClient } from "./resilient-llm-client";
import { MockLLMClient } from "./mock-llm-client";
import {
  ErrorClassifier,
  TransientError,
  TerminalError,
} from "./error-classifier";

describe("ResilientLLMClient", () => {
  let mockClient: MockLLMClient;
  let classifier: ErrorClassifier;
  let resilientClient: ResilientLLMClient;

  beforeEach(() => {
    mockClient = new MockLLMClient();
    classifier = new ErrorClassifier();
    resilientClient = new ResilientLLMClient(mockClient, classifier);

    // Use fake timers for precise timing tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("successful calls", () => {
    it("should return response on first successful attempt", async () => {
      mockClient.setResponse("test", "success");

      const promise = resilientClient.call("test");
      jest.runAllTimers();
      const response = await promise;

      expect(response.content).toBe("success");
    });

    it("should delegate countTokens to underlying client", () => {
      const tokens = resilientClient.countTokens("test string");

      expect(tokens).toBe(mockClient.countTokens("test string"));
      expect(tokens).toBe(3); // 11 chars / 4 = 2.75, rounded up to 3
    });
  });

  describe("transient error retry logic", () => {
    it("should retry on transient error and succeed", async () => {
      let callCount = 0;
      mockClient.setResponse("test", "success");

      // Fail first call, succeed second
      const originalCall = mockClient.call.bind(mockClient);
      mockClient.call = jest.fn(async (prompt, config) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Network error");
        }
        return originalCall(prompt, config);
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();
      const response = await promise;

      expect(response.content).toBe("success");
      expect(mockClient.call).toHaveBeenCalledTimes(2);
    });

    it("should retry exactly 3 times before throwing", async () => {
      let callCount = 0;
      const error = { code: "ECONNRESET", message: "Connection reset" };

      mockClient.call = jest.fn(async () => {
        callCount++;
        throw error;
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("Network error");
      expect(mockClient.call).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("should implement exponential backoff: 1s, 2s, 4s", async () => {
      const delays: number[] = [];
      const startTime = Date.now();

      mockClient.call = jest.fn(async () => {
        delays.push(Date.now() - startTime);
        throw { code: "ETIMEDOUT", message: "Timeout" };
      });

      const promise = resilientClient.call("test");

      // Advance time and check delays
      // First attempt: immediate (0ms)
      await Promise.resolve();
      expect(delays[0]).toBe(0);

      // Second attempt: after 1s
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(delays[1]).toBe(1000);

      // Third attempt: after 2s more (total 3s)
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(delays[2]).toBe(3000);

      // Fourth attempt: after 4s more (total 7s)
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
      expect(delays[3]).toBe(7000);

      // Complete the promise
      jest.runAllTimers();
      await expect(promise).rejects.toThrow();

      expect(delays).toEqual([0, 1000, 3000, 7000]);
    });

    it("should respect retry-after header for rate limits", async () => {
      const error = {
        status: 429,
        message: "Rate limited",
        retryAfter: 5, // 5 seconds
      };

      let callCount = 0;
      mockClient.call = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw error;
        }
        return {
          content: "success",
          tokensUsed: 10,
          finishReason: "stop",
          model: "test",
        };
      });

      const promise = resilientClient.call("test");

      // First attempt fails immediately
      await Promise.resolve();

      // Should wait for retry-after (5000ms)
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      jest.runAllTimers();
      const response = await promise;

      expect(response.content).toBe("success");
      expect(mockClient.call).toHaveBeenCalledTimes(2);
    });

    it("should handle 500 server errors with retry", async () => {
      let callCount = 0;
      mockClient.call = jest.fn(async () => {
        callCount++;
        if (callCount <= 2) {
          throw { status: 500, message: "Internal server error" };
        }
        return {
          content: "success",
          tokensUsed: 10,
          finishReason: "stop",
          model: "test",
        };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();
      const response = await promise;

      expect(response.content).toBe("success");
      expect(mockClient.call).toHaveBeenCalledTimes(3);
    });

    it("should handle 502 bad gateway with retry", async () => {
      let callCount = 0;
      mockClient.call = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw { status: 502, message: "Bad gateway" };
        }
        return {
          content: "success",
          tokensUsed: 10,
          finishReason: "stop",
          model: "test",
        };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();
      const response = await promise;

      expect(response.content).toBe("success");
    });

    it("should handle 503 service unavailable with retry", async () => {
      let callCount = 0;
      mockClient.call = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw { status: 503, message: "Service unavailable" };
        }
        return {
          content: "success",
          tokensUsed: 10,
          finishReason: "stop",
          model: "test",
        };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();
      const response = await promise;

      expect(response.content).toBe("success");
    });

    it("should handle 504 gateway timeout with retry", async () => {
      let callCount = 0;
      mockClient.call = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw { status: 504, message: "Gateway timeout" };
        }
        return {
          content: "success",
          tokensUsed: 10,
          finishReason: "stop",
          model: "test",
        };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();
      const response = await promise;

      expect(response.content).toBe("success");
    });
  });

  describe("terminal error handling", () => {
    it("should fail immediately on 401 unauthorized", async () => {
      mockClient.call = jest.fn(async () => {
        throw { status: 401, message: "Unauthorized" };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("Invalid API key");
      expect(mockClient.call).toHaveBeenCalledTimes(1); // No retries
    });

    it("should fail immediately on 400 bad request", async () => {
      mockClient.call = jest.fn(async () => {
        throw { status: 400, message: "Bad request" };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("Invalid request");
      expect(mockClient.call).toHaveBeenCalledTimes(1);
    });

    it("should fail immediately on 404 not found", async () => {
      mockClient.call = jest.fn(async () => {
        throw { status: 404, message: "Not found" };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("Not found");
      expect(mockClient.call).toHaveBeenCalledTimes(1);
    });

    it("should fail immediately on content policy violation", async () => {
      mockClient.call = jest.fn(async () => {
        throw {
          code: "content_policy_violation",
          message: "Content policy violation",
        };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("Content policy violation");
      expect(mockClient.call).toHaveBeenCalledTimes(1);
    });

    it("should throw TerminalError instance", async () => {
      mockClient.call = jest.fn(async () => {
        throw { status: 401, message: "Unauthorized" };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      await expect(promise).rejects.toBeInstanceOf(TerminalError);
    });
  });

  describe("configuration", () => {
    it("should allow setting max retries", async () => {
      resilientClient.setMaxRetries(1); // Only 1 retry instead of 3

      mockClient.call = jest.fn(async () => {
        throw { code: "ETIMEDOUT", message: "Timeout" };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      await expect(promise).rejects.toThrow();
      expect(mockClient.call).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it("should allow setting base delay", async () => {
      resilientClient.setBaseDelay(500); // 500ms instead of 1000ms

      const delays: number[] = [];
      const startTime = Date.now();

      let callCount = 0;
      mockClient.call = jest.fn(async () => {
        delays.push(Date.now() - startTime);
        callCount++;
        if (callCount <= 2) {
          throw { code: "ETIMEDOUT", message: "Timeout" };
        }
        return {
          content: "success",
          tokensUsed: 10,
          finishReason: "stop",
          model: "test",
        };
      });

      const promise = resilientClient.call("test");

      // First attempt
      await Promise.resolve();

      // Second attempt: after 500ms (baseDelay * 2^0)
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Third attempt: after 1000ms more (baseDelay * 2^1)
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      jest.runAllTimers();
      await promise;

      expect(delays).toEqual([0, 500, 1500]);
    });
  });

  describe("edge cases", () => {
    it("should handle mixed error types correctly", async () => {
      let callCount = 0;
      mockClient.call = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // Transient error - should retry
          throw { status: 503, message: "Service unavailable" };
        }
        if (callCount === 2) {
          // Terminal error - should fail immediately
          throw { status: 401, message: "Unauthorized" };
        }
        return {
          content: "success",
          tokensUsed: 10,
          finishReason: "stop",
          model: "test",
        };
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("Invalid API key");
      expect(mockClient.call).toHaveBeenCalledTimes(2); // First retry, then terminal
    });

    it("should preserve original error properties", async () => {
      const originalError = {
        status: 429,
        message: "Rate limited",
        code: "rate_limit_exceeded",
        retryAfter: 10,
      };

      mockClient.call = jest.fn(async () => {
        throw originalError;
      });

      const promise = resilientClient.call("test");
      jest.runAllTimers();

      try {
        await promise;
        fail("Should have thrown error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(TransientError);
        expect(error.code).toBe("RATE_LIMIT");
        expect(error.retryAfter).toBe(10000); // 10 seconds in ms
      }
    });
  });

  describe("real timing tests", () => {
    beforeEach(() => {
      jest.useRealTimers(); // Use real timers for these tests
    });

    afterEach(() => {
      jest.useFakeTimers();
    });

    it("should actually wait during retries", async () => {
      resilientClient.setBaseDelay(50); // Use short delay for faster test

      let callCount = 0;
      const timestamps: number[] = [];
      const startTime = Date.now();

      mockClient.call = jest.fn(async () => {
        timestamps.push(Date.now() - startTime);
        callCount++;
        if (callCount <= 2) {
          throw { code: "ETIMEDOUT", message: "Timeout" };
        }
        return {
          content: "success",
          tokensUsed: 10,
          finishReason: "stop",
          model: "test",
        };
      });

      await resilientClient.call("test");

      // Verify delays are approximately correct
      expect(timestamps[0]).toBeLessThan(10); // First call immediate
      expect(timestamps[1]).toBeGreaterThanOrEqual(50); // After 50ms delay
      expect(timestamps[1]).toBeLessThan(70); // But not too long
      expect(timestamps[2]).toBeGreaterThanOrEqual(150); // After 50 + 100ms
      expect(timestamps[2]).toBeLessThan(180); // But not too long
    }, 10000);
  });
});
