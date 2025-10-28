/**
 * Phase 5 Serialization Tests
 *
 * Tests the main Phase 5 orchestrator including cache write ordering
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  Phase5Serialization,
  type ExecutionResult,
  PHASE5_CONFIG,
} from "./phase5-serialization";
import { CostAttributor } from "./cost-attributor";
import { BillingReporter } from "./billing-reporter";
import { ResponseSerializer } from "./response-serializer";
import { ResultCache } from "./result-cache";
import { AuditLogger } from "./audit-logger";
import type { AguiResponse } from "./types";

describe("Phase5Serialization", () => {
  let phase5: Phase5Serialization;
  let mockCostAttributor: jest.Mocked<CostAttributor>;
  let mockBillingReporter: jest.Mocked<BillingReporter>;
  let mockSerializer: jest.Mocked<ResponseSerializer>;
  let mockCache: jest.Mocked<ResultCache>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let validExecutionResult: ExecutionResult;
  let startTime: number;

  beforeEach(() => {
    // Create mocks
    mockCostAttributor = {
      calculateCostBreakdown: jest.fn(),
    } as any;

    mockBillingReporter = {
      generateReport: jest.fn(),
      persistReport: jest.fn(),
    } as any;

    mockSerializer = {
      enrich: jest.fn(),
      validateWithErrors: jest.fn(),
      validate: jest.fn(),
    } as any;

    mockCache = {
      write: jest.fn(),
    } as any;

    mockAuditLogger = {
      log: jest.fn(),
    } as any;

    // Create Phase5 instance with mocks
    phase5 = new Phase5Serialization(
      mockCostAttributor,
      mockBillingReporter,
      mockSerializer,
      mockCache,
      mockAuditLogger
    );

    // Setup valid execution result
    startTime = Date.now();
    validExecutionResult = {
      response: {
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        jobSignature: "test-signature",
        status: "COMPLETE",
        result: { data: "test" },
        phaseResult: "CONTINUE",
        fromCache: false,
        executionTime: 0,
        tokensUsed: 1000,
        totalCost: 0.007,
        decisions: [
          { actionType: "FINAL_ANSWER", status: "COMPLETE" },
        ],
        toolCalls: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      tokensUsed: 1000,
      toolCalls: [],
      decisions: [
        { actionType: "FINAL_ANSWER", status: "COMPLETE" },
      ],
      recursionDepth: 0,
      status: "COMPLETE",
      phaseResult: "CONTINUE",
      fromCache: false,
    };

    // Setup default mock implementations
    mockCostAttributor.calculateCostBreakdown.mockReturnValue({
      tokenCost: 0.002,
      toolCost: 0.005,
      totalCost: 0.007,
      breakdown: [
        { phase: "EXECUTION", tokens: 1000, tools: 1, cost: 0.007 },
      ],
    });

    mockBillingReporter.generateReport.mockResolvedValue({
      correlationId: validExecutionResult.response.correlationId,
      userId: "test-user",
      totalCost: 0.007,
      costBreakdown: {
        tokenCost: 0.002,
        toolCost: 0.005,
        totalCost: 0.007,
        breakdown: [],
      },
      executionTime: 1000,
      timestamp: new Date(),
      metrics: {
        tokensUsed: 1000,
        toolCallsCount: 0,
        llmCallsCount: 0,
        recursionDepth: 0,
      },
    });

    mockSerializer.enrich.mockReturnValue(validExecutionResult.response);
    mockSerializer.validateWithErrors.mockReturnValue({ valid: true });
    mockSerializer.validate.mockReturnValue(true);
    mockCache.write.mockResolvedValue();
    mockAuditLogger.log.mockResolvedValue();
    mockBillingReporter.persistReport.mockResolvedValue();
  });

  describe("execute", () => {
    it("should execute all steps in correct order", async () => {
      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result.response).toBeDefined();
      expect(result.cached).toBe(true);

      // Verify all steps were called
      expect(mockCostAttributor.calculateCostBreakdown).toHaveBeenCalled();
      expect(mockBillingReporter.generateReport).toHaveBeenCalled();
      expect(mockSerializer.enrich).toHaveBeenCalled();
      expect(mockSerializer.validateWithErrors).toHaveBeenCalled();
      expect(mockCache.write).toHaveBeenCalled();
      expect(mockBillingReporter.persistReport).toHaveBeenCalled();
    });

    it("should calculate execution time correctly", async () => {
      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result.response.executionTime).toBeGreaterThan(0);
    });

    it("should calculate costs using CostAttributor", async () => {
      await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(mockCostAttributor.calculateCostBreakdown).toHaveBeenCalledWith({
        tokensUsed: validExecutionResult.tokensUsed,
        toolCalls: validExecutionResult.toolCalls,
        decisions: validExecutionResult.decisions,
      });
    });

    it("should generate billing report", async () => {
      await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(mockBillingReporter.generateReport).toHaveBeenCalledWith(
        validExecutionResult.response.correlationId,
        "test-user",
        expect.objectContaining({
          tokensUsed: validExecutionResult.tokensUsed,
          toolCalls: validExecutionResult.toolCalls,
          decisions: validExecutionResult.decisions,
        })
      );
    });

    it("should enrich response with cost metadata", async () => {
      await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(mockSerializer.enrich).toHaveBeenCalledWith(
        validExecutionResult.response,
        expect.objectContaining({
          costBreakdown: expect.any(Object),
          billingReport: expect.any(Object),
        })
      );
    });

    it("should validate enriched response", async () => {
      await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(mockSerializer.validateWithErrors).toHaveBeenCalled();
    });

    it("should write to cache BEFORE returning for successful executions", async () => {
      const cacheWriteOrder: string[] = [];

      mockCache.write.mockImplementation(async () => {
        cacheWriteOrder.push("cache_write");
      });

      const originalExecute = phase5.execute.bind(phase5);
      phase5.execute = async (...args) => {
        const result = await originalExecute(...args);
        cacheWriteOrder.push("return");
        return result;
      };

      await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(cacheWriteOrder[0]).toBe("cache_write");
      expect(cacheWriteOrder[1]).toBe("return");
    });

    it("should NOT cache error responses", async () => {
      const errorResult = {
        ...validExecutionResult,
        status: "ERROR",
        response: {
          ...validExecutionResult.response,
          status: "ERROR" as any,
        },
      };

      await phase5.execute(
        errorResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(mockCache.write).not.toHaveBeenCalled();
    });

    it("should NOT cache already-cached responses", async () => {
      const cachedResult = {
        ...validExecutionResult,
        fromCache: true,
        response: {
          ...validExecutionResult.response,
          fromCache: true,
        },
      };

      await phase5.execute(
        cachedResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(mockCache.write).not.toHaveBeenCalled();
    });

    it("should log FINAL_BILLING_REPORT event", async () => {
      await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: PHASE5_CONFIG.EVENTS.FINAL_BILLING_REPORT,
          details: expect.objectContaining({
            totalCost: expect.any(Number),
            costBreakdown: expect.any(Object),
            metrics: expect.any(Object),
          }),
        })
      );
    });

    it("should persist billing report to database", async () => {
      await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(mockBillingReporter.persistReport).toHaveBeenCalledWith(
        expect.any(Object),
        "test-signature",
        expect.any(Object)
      );
    });

    it("should log all phase events", async () => {
      await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      // Check that key events were logged
      const logCalls = mockAuditLogger.log.mock.calls;
      const events = logCalls.map((call) => call[0].event);

      expect(events).toContain(PHASE5_CONFIG.EVENTS.COST_CALCULATED);
      expect(events).toContain(PHASE5_CONFIG.EVENTS.BILLING_REPORT_GENERATED);
      expect(events).toContain(PHASE5_CONFIG.EVENTS.RESPONSE_VALIDATED);
      expect(events).toContain(PHASE5_CONFIG.EVENTS.FINAL_BILLING_REPORT);
      expect(events).toContain(PHASE5_CONFIG.EVENTS.METADATA_PERSISTED);
      expect(events).toContain(PHASE5_CONFIG.EVENTS.PHASE_COMPLETE);
    });

    it("should handle validation failure", async () => {
      mockSerializer.validateWithErrors.mockReturnValue({
        valid: false,
        errors: [
          {
            path: "correlationId",
            message: "Invalid UUID",
            code: "invalid_uuid",
          },
        ],
      });

      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result.response.error).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "PHASE_ERROR",
        })
      );
    });

    it("should continue execution if cache write fails", async () => {
      mockCache.write.mockRejectedValue(new Error("Cache write failed"));

      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result.response).toBeDefined();
      expect(result.cached).toBe(false);
      expect(mockBillingReporter.persistReport).toHaveBeenCalled();
    });

    it("should continue execution if billing persist fails", async () => {
      mockBillingReporter.persistReport.mockRejectedValue(
        new Error("DB error")
      );

      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result.response).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "BILLING_PERSIST_ERROR",
        })
      );
    });

    it("should set cached flag correctly", async () => {
      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result.cached).toBe(true);
    });
  });

  describe("executeForCachedResponse", () => {
    it("should update correlation ID for cached response", async () => {
      const cachedResponse: AguiResponse = {
        correlationId: "old-correlation-id",
        jobSignature: "test-signature",
        status: "COMPLETE",
        result: { data: "cached" },
        phaseResult: "CACHE_HIT",
        fromCache: true,
        executionTime: 500,
        decisions: [],
        toolCalls: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      const newCorrelationId = "550e8400-e29b-41d4-a716-446655440000";

      const result = await phase5.executeForCachedResponse(
        cachedResponse,
        newCorrelationId,
        "test-user",
        "test-signature"
      );

      expect(result.response.correlationId).toBe(newCorrelationId);
      expect(result.response.fromCache).toBe(true);
      expect(result.cached).toBe(true);
    });

    it("should validate cached response", async () => {
      const cachedResponse: AguiResponse = {
        correlationId: "old-id",
        jobSignature: "test-signature",
        status: "COMPLETE",
        result: {},
        phaseResult: "CACHE_HIT",
        fromCache: true,
        executionTime: 100,
        decisions: [],
        toolCalls: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      await phase5.executeForCachedResponse(
        cachedResponse,
        "550e8400-e29b-41d4-a716-446655440000",
        "test-user",
        "test-signature"
      );

      expect(mockSerializer.validate).toHaveBeenCalled();
    });

    it("should throw error if cached response is invalid", async () => {
      mockSerializer.validate.mockReturnValue(false);

      const cachedResponse: AguiResponse = {
        correlationId: "old-id",
        jobSignature: "test-signature",
        status: "COMPLETE",
        result: {},
        phaseResult: "CACHE_HIT",
        fromCache: true,
        executionTime: 100,
        decisions: [],
        toolCalls: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      await expect(
        phase5.executeForCachedResponse(
          cachedResponse,
          "550e8400-e29b-41d4-a716-446655440000",
          "test-user",
          "test-signature"
        )
      ).rejects.toThrow("Cached response failed validation");
    });

    it("should log cached response event", async () => {
      const cachedResponse: AguiResponse = {
        correlationId: "old-id",
        jobSignature: "test-signature",
        status: "COMPLETE",
        result: {},
        phaseResult: "CACHE_HIT",
        fromCache: true,
        executionTime: 100,
        totalCost: 0.005,
        decisions: [],
        toolCalls: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      await phase5.executeForCachedResponse(
        cachedResponse,
        "550e8400-e29b-41d4-a716-446655440000",
        "test-user",
        "test-signature"
      );

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "CACHED_RESPONSE_RETURNED",
          details: expect.objectContaining({
            intentSignature: "test-signature",
            originalCorrelationId: "old-id",
            totalCost: 0.005,
          }),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle cost calculation errors", async () => {
      mockCostAttributor.calculateCostBreakdown.mockImplementation(() => {
        throw new Error("Cost calculation failed");
      });

      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result.response.error).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "PHASE_ERROR",
        })
      );
    });

    it("should handle billing report generation errors", async () => {
      mockBillingReporter.generateReport.mockRejectedValue(
        new Error("Billing failed")
      );

      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result.response.error).toBeDefined();
    });

    it("should return response even on error", async () => {
      mockSerializer.enrich.mockImplementation(() => {
        throw new Error("Enrichment failed");
      });

      const result = await phase5.execute(
        validExecutionResult,
        "test-signature",
        "test-user",
        startTime
      );

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.cached).toBe(false);
    });
  });
});
