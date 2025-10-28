/**
 * Response Serializer Tests
 *
 * Tests serialization, deserialization, enrichment, and validation
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { ResponseSerializer } from "./response-serializer";
import type { AguiResponse } from "./types";
import type { CostBreakdown } from "./cost-attributor";
import type { BillingReport } from "./billing-reporter";

describe("ResponseSerializer", () => {
  let serializer: ResponseSerializer;
  let validResponse: AguiResponse;

  beforeEach(() => {
    serializer = new ResponseSerializer();

    validResponse = {
      correlationId: "550e8400-e29b-41d4-a716-446655440000",
      jobSignature: "test-signature",
      status: "COMPLETE",
      result: { data: "test result" },
      phaseResult: "CONTINUE",
      fromCache: false,
      executionTime: 1000,
      tokensUsed: 500,
      totalCost: 0.001,
      decisions: [
        {
          actionType: "FINAL_ANSWER",
          status: "COMPLETE",
          finalAnswer: "test answer",
        },
      ],
      toolCalls: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  });

  describe("serialize", () => {
    it("should serialize response to formatted JSON", () => {
      const json = serializer.serialize(validResponse);

      expect(typeof json).toBe("string");
      expect(json).toContain("correlationId");
      expect(json).toContain("550e8400-e29b-41d4-a716-446655440000");
      expect(json.includes("\n")).toBe(true); // Check for formatting
    });

    it("should handle complex nested objects", () => {
      const complexResponse = {
        ...validResponse,
        result: {
          nested: {
            data: "test",
            array: [1, 2, 3],
            object: { key: "value" },
          },
        },
      };

      const json = serializer.serialize(complexResponse);
      const parsed = JSON.parse(json);

      expect(parsed.result.nested.data).toBe("test");
      expect(parsed.result.nested.array).toEqual([1, 2, 3]);
    });

    it("should throw error for non-serializable data", () => {
      const invalidResponse = {
        ...validResponse,
        circular: {} as any,
      };
      invalidResponse.circular.self = invalidResponse.circular;

      expect(() => serializer.serialize(invalidResponse as any)).toThrow(
        "Failed to serialize response"
      );
    });
  });

  describe("serializeCompact", () => {
    it("should serialize response without formatting", () => {
      const json = serializer.serializeCompact(validResponse);

      expect(typeof json).toBe("string");
      expect(json).toContain("correlationId");
      // Should not have line breaks (compact format)
      const lineBreaks = json.match(/\n/g);
      expect(lineBreaks).toBeNull();
    });

    it("should be smaller than formatted version", () => {
      const formatted = serializer.serialize(validResponse);
      const compact = serializer.serializeCompact(validResponse);

      expect(compact.length).toBeLessThan(formatted.length);
    });
  });

  describe("deserialize", () => {
    it("should deserialize valid JSON", () => {
      const json = serializer.serialize(validResponse);
      const deserialized = serializer.deserialize(json);

      expect(deserialized.correlationId).toBe(validResponse.correlationId);
      expect(deserialized.status).toBe(validResponse.status);
      expect(deserialized.executionTime).toBe(validResponse.executionTime);
    });

    it("should validate against schema during deserialization", () => {
      const invalidJson = JSON.stringify({
        correlationId: "invalid-id", // Not a UUID
        status: "COMPLETE",
      });

      expect(() => serializer.deserialize(invalidJson)).toThrow();
    });

    it("should throw error for invalid JSON syntax", () => {
      const invalidJson = '{"invalid": json}';

      expect(() => serializer.deserialize(invalidJson)).toThrow(
        "Invalid JSON"
      );
    });

    it("should handle missing required fields", () => {
      const incompleteJson = JSON.stringify({
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        // Missing other required fields
      });

      expect(() => serializer.deserialize(incompleteJson)).toThrow(
        "Response validation failed"
      );
    });
  });

  describe("enrich", () => {
    it("should enrich response with cost breakdown", () => {
      const costBreakdown: CostBreakdown = {
        tokenCost: 0.002,
        toolCost: 0.005,
        totalCost: 0.007,
        breakdown: [
          { phase: "EXECUTION", tokens: 1000, tools: 1, cost: 0.007 },
        ],
      };

      const enriched = serializer.enrich(validResponse, { costBreakdown });

      expect(enriched.totalCost).toBe(0.007);
      expect(enriched.tokensUsed).toBe(1000);
    });

    it("should enrich response with billing report", () => {
      const billingReport: BillingReport = {
        correlationId: validResponse.correlationId,
        userId: "test-user",
        totalCost: 0.015,
        costBreakdown: {
          tokenCost: 0.01,
          toolCost: 0.005,
          totalCost: 0.015,
          breakdown: [],
        },
        executionTime: 2000,
        timestamp: new Date(),
        metrics: {
          tokensUsed: 5000,
          toolCallsCount: 1,
          llmCallsCount: 2,
          recursionDepth: 1,
        },
      };

      const enriched = serializer.enrich(validResponse, { billingReport });

      expect(enriched.totalCost).toBe(0.015);
      expect(enriched.tokensUsed).toBe(5000);
    });

    it("should not modify original response", () => {
      const originalTotalCost = validResponse.totalCost;
      const costBreakdown: CostBreakdown = {
        tokenCost: 0.002,
        toolCost: 0.005,
        totalCost: 0.007,
        breakdown: [],
      };

      serializer.enrich(validResponse, { costBreakdown });

      expect(validResponse.totalCost).toBe(originalTotalCost);
    });
  });

  describe("validate", () => {
    it("should validate correct response", () => {
      const isValid = serializer.validate(validResponse);
      expect(isValid).toBe(true);
    });

    it("should reject response with invalid correlation ID", () => {
      const invalidResponse = {
        ...validResponse,
        correlationId: "not-a-uuid",
      };

      const isValid = serializer.validate(invalidResponse as any);
      expect(isValid).toBe(false);
    });

    it("should reject response with invalid status", () => {
      const invalidResponse = {
        ...validResponse,
        status: "INVALID_STATUS",
      };

      const isValid = serializer.validate(invalidResponse as any);
      expect(isValid).toBe(false);
    });

    it("should reject response with missing required fields", () => {
      const invalidResponse = {
        correlationId: validResponse.correlationId,
        status: validResponse.status,
        // Missing other required fields
      };

      const isValid = serializer.validate(invalidResponse as any);
      expect(isValid).toBe(false);
    });
  });

  describe("validateWithErrors", () => {
    it("should return valid result for correct response", () => {
      const result = serializer.validateWithErrors(validResponse);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should return detailed errors for invalid response", () => {
      const invalidResponse = {
        ...validResponse,
        correlationId: "not-a-uuid",
      };

      const result = serializer.validateWithErrors(invalidResponse as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toHaveProperty("path");
      expect(result.errors![0]).toHaveProperty("message");
      expect(result.errors![0]).toHaveProperty("code");
    });
  });

  describe("createErrorResponse", () => {
    it("should create minimal error response", () => {
      const errorResponse = serializer.createErrorResponse(
        "test-correlation-id",
        "test-signature",
        "ERROR",
        {
          code: "TEST_ERROR",
          message: "Test error message",
        }
      );

      expect(errorResponse.correlationId).toBe("test-correlation-id");
      expect(errorResponse.jobSignature).toBe("test-signature");
      expect(errorResponse.status).toBe("ERROR");
      expect(errorResponse.error?.code).toBe("TEST_ERROR");
      expect(errorResponse.error?.message).toBe("Test error message");
      expect(errorResponse.phaseResult).toBe("ERROR");
      expect(errorResponse.fromCache).toBe(false);
      expect(errorResponse.decisions).toEqual([]);
      expect(errorResponse.toolCalls).toEqual([]);
    });

    it("should include error details", () => {
      const errorResponse = serializer.createErrorResponse(
        "test-correlation-id",
        "test-signature",
        "ERROR",
        {
          code: "TEST_ERROR",
          message: "Test error",
          details: { stack: "stack trace" },
        }
      );

      expect(errorResponse.error?.details).toEqual({ stack: "stack trace" });
    });
  });

  describe("clone", () => {
    it("should create deep copy of response", () => {
      const cloned = serializer.clone(validResponse);

      expect(cloned).toEqual(validResponse);
      expect(cloned).not.toBe(validResponse); // Different object reference
    });

    it("should not share nested object references", () => {
      const cloned = serializer.clone(validResponse);

      cloned.decisions.push({
        actionType: "LLM_CALL",
        status: "NEXT_STEP",
      });

      expect(cloned.decisions.length).not.toBe(validResponse.decisions.length);
    });
  });

  describe("sanitize", () => {
    it("should remove sensitive data from tool results", () => {
      const responseWithTools = {
        ...validResponse,
        toolCalls: [
          { toolName: "google_search" as const, result: "sensitive data" },
        ],
      };

      const sanitized = serializer.sanitize(responseWithTools);

      expect(sanitized.toolCalls[0].result).toBe("[SANITIZED]");
    });

    it("should remove sensitive data from tool arguments", () => {
      const responseWithArgs = {
        ...validResponse,
        decisions: [
          {
            actionType: "TOOL_CALL" as const,
            status: "COMPLETE" as const,
            toolName: "google_search" as const,
            toolArguments: { query: "sensitive query" },
          },
        ],
      };

      const sanitized = serializer.sanitize(responseWithArgs);

      expect(sanitized.decisions[0].toolArguments).toEqual({
        "[SANITIZED]": true,
      });
    });

    it("should not modify original response", () => {
      const responseWithTools = {
        ...validResponse,
        toolCalls: [
          { toolName: "google_search" as const, result: "sensitive data" },
        ],
      };

      serializer.sanitize(responseWithTools);

      expect(responseWithTools.toolCalls[0].result).toBe("sensitive data");
    });
  });

  describe("summarize", () => {
    it("should create response summary", () => {
      const summary = serializer.summarize(validResponse);

      expect(summary.correlationId).toBe(validResponse.correlationId);
      expect(summary.status).toBe(validResponse.status);
      expect(summary.phaseResult).toBe(validResponse.phaseResult);
      expect(summary.fromCache).toBe(validResponse.fromCache);
      expect(summary.executionTime).toBe(validResponse.executionTime);
      expect(summary.totalCost).toBe(validResponse.totalCost);
      expect(summary.tokensUsed).toBe(validResponse.tokensUsed);
      expect(summary.toolCallsCount).toBe(0);
      expect(summary.decisionsCount).toBe(1);
      expect(summary.hasError).toBe(false);
    });

    it("should indicate error presence", () => {
      const errorResponse = {
        ...validResponse,
        error: {
          code: "TEST_ERROR",
          message: "Test error",
        },
      };

      const summary = serializer.summarize(errorResponse);

      expect(summary.hasError).toBe(true);
    });
  });

  describe("toHttpResponse", () => {
    it("should convert successful response to HTTP format", () => {
      const httpResponse = serializer.toHttpResponse(validResponse);

      expect(httpResponse.statusCode).toBe(200);
      expect(httpResponse.body).toContain(validResponse.correlationId);
      expect(httpResponse.headers["Content-Type"]).toBe("application/json");
      expect(httpResponse.headers["X-Correlation-Id"]).toBe(
        validResponse.correlationId
      );
      expect(httpResponse.headers["X-Cache-Hit"]).toBe("false");
      expect(httpResponse.headers["X-Execution-Time"]).toBe("1000");
    });

    it("should use 500 status code for error response", () => {
      const errorResponse = {
        ...validResponse,
        error: {
          code: "TEST_ERROR",
          message: "Test error",
        },
      };

      const httpResponse = serializer.toHttpResponse(errorResponse);

      expect(httpResponse.statusCode).toBe(500);
    });

    it("should include cache hit header", () => {
      const cachedResponse = {
        ...validResponse,
        fromCache: true,
      };

      const httpResponse = serializer.toHttpResponse(cachedResponse);

      expect(httpResponse.headers["X-Cache-Hit"]).toBe("true");
    });
  });
});
