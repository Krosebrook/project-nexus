/**
 * Tests for ErrorClassifier
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ErrorClassifier, TransientError, TerminalError } from "./error-classifier";

describe("ErrorClassifier", () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  describe("TransientError classification", () => {
    it("should classify 429 status as rate limit error", () => {
      const error = { status: 429, message: "Too many requests" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TransientError);
      expect(result.code).toBe("RATE_LIMIT");
      expect(result.message).toContain("Rate limit exceeded");
    });

    it("should extract retry-after header for rate limits", () => {
      const error = {
        status: 429,
        message: "Too many requests",
        retryAfter: 60,
      };
      const result = classifier.classify(error) as TransientError;

      expect(result).toBeInstanceOf(TransientError);
      expect(result.retryAfter).toBe(60000); // 60 seconds in ms
    });

    it("should classify network errors as transient", () => {
      const networkErrors = [
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNREFUSED",
        "ENOTFOUND",
        "EAI_AGAIN",
        "ENETUNREACH",
        "EHOSTUNREACH",
      ];

      networkErrors.forEach((code) => {
        const error = { code, message: "Network error" };
        const result = classifier.classify(error);

        expect(result).toBeInstanceOf(TransientError);
        expect(result.code).toBe("NETWORK_ERROR");
      });
    });

    it("should classify timeout errors as transient", () => {
      const timeoutErrors = [
        { code: "ETIMEDOUT", message: "Connection timed out" },
        { code: "timeout", message: "Request timeout" },
        { message: "Request timed out" },
        { message: "Connection timeout" },
      ];

      timeoutErrors.forEach((error) => {
        const result = classifier.classify(error);

        expect(result).toBeInstanceOf(TransientError);
        expect(result.code).toBe("TIMEOUT");
      });
    });

    it("should classify 500 errors as server errors", () => {
      const error = { status: 500, message: "Internal server error" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TransientError);
      expect(result.code).toBe("SERVER_ERROR");
      expect(result.message).toContain("500");
    });

    it("should classify 502 errors as server errors", () => {
      const error = { status: 502, message: "Bad gateway" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TransientError);
      expect(result.code).toBe("SERVER_ERROR");
    });

    it("should classify 503 errors as server errors", () => {
      const error = { status: 503, message: "Service unavailable" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TransientError);
      expect(result.code).toBe("SERVER_ERROR");
    });

    it("should classify 504 errors as server errors", () => {
      const error = { status: 504, message: "Gateway timeout" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TransientError);
      expect(result.code).toBe("SERVER_ERROR");
    });
  });

  describe("TerminalError classification", () => {
    it("should classify 401 as invalid API key", () => {
      const error = { status: 401, message: "Unauthorized" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.code).toBe("INVALID_API_KEY");
    });

    it("should classify invalid_api_key code as terminal", () => {
      const error = { code: "invalid_api_key", message: "Invalid API key" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.code).toBe("INVALID_API_KEY");
    });

    it("should classify 400 as invalid request", () => {
      const error = { status: 400, message: "Bad request" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.code).toBe("INVALID_REQUEST");
    });

    it("should classify invalid_request_error code as terminal", () => {
      const error = {
        code: "invalid_request_error",
        message: "Invalid request",
      };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.code).toBe("INVALID_REQUEST");
    });

    it("should classify 404 as not found", () => {
      const error = { status: 404, message: "Not found" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.code).toBe("NOT_FOUND");
    });

    it("should classify content policy violations as terminal", () => {
      const policyErrors = [
        { code: "content_policy_violation", message: "Content policy violation" },
        { code: "content_filter", message: "Content filtered" },
        { message: "This content violates our content policy" },
        { message: "Content filter triggered" },
      ];

      policyErrors.forEach((error) => {
        const result = classifier.classify(error);

        expect(result).toBeInstanceOf(TerminalError);
        expect(result.code).toBe("CONTENT_POLICY_VIOLATION");
      });
    });

    it("should classify invalid model errors as terminal", () => {
      const error = {
        status: 404,
        message: "The model 'gpt-5' does not exist",
      };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.code).toBe("INVALID_MODEL");
    });
  });

  describe("Error code variations", () => {
    it("should handle statusCode property", () => {
      const error = { statusCode: 429, message: "Rate limited" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TransientError);
      expect(result.code).toBe("RATE_LIMIT");
    });

    it("should handle error.code as string number", () => {
      const error = { code: "429", message: "Rate limited" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TransientError);
      expect(result.code).toBe("RATE_LIMIT");
    });

    it("should handle nested error codes", () => {
      const error = {
        error: { code: "invalid_api_key" },
        message: "Auth failed",
      };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.code).toBe("INVALID_API_KEY");
    });

    it("should handle headers for retry-after", () => {
      const error = {
        status: 429,
        message: "Rate limited",
        headers: { "retry-after": "30" },
      };
      const result = classifier.classify(error) as TransientError;

      expect(result.retryAfter).toBe(30000); // 30 seconds in ms
    });
  });

  describe("Unknown errors", () => {
    it("should classify unknown errors as terminal", () => {
      const error = { message: "Something weird happened" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.message).toContain("Unknown error");
    });

    it("should preserve error code for unknown errors", () => {
      const error = { code: "WEIRD_ERROR", message: "Unknown issue" };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.code).toBe("WEIRD_ERROR");
    });

    it("should handle errors with no message", () => {
      const error = { status: 418 };
      const result = classifier.classify(error);

      expect(result).toBeInstanceOf(TerminalError);
      expect(result.message).toContain("Unknown error");
    });
  });

  describe("Error prototype chain", () => {
    it("should maintain TransientError prototype", () => {
      const error = { status: 429, message: "Rate limited" };
      const result = classifier.classify(error);

      expect(result instanceof TransientError).toBe(true);
      expect(result instanceof Error).toBe(true);
      expect(result.name).toBe("TransientError");
    });

    it("should maintain TerminalError prototype", () => {
      const error = { status: 401, message: "Unauthorized" };
      const result = classifier.classify(error);

      expect(result instanceof TerminalError).toBe(true);
      expect(result instanceof Error).toBe(true);
      expect(result.name).toBe("TerminalError");
    });
  });
});
