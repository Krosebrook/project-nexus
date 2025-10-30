/**
 * Phase 5: Serialization & Cost Attribution
 *
 * The final phase of agent execution that:
 * 1. Calculates total cost (CostAttributor)
 * 2. Generates billing report
 * 3. Enriches response with cost metadata
 * 4. Validates response (ResponseSerializer)
 * 5. Writes to cache (BEFORE returning - critical!)
 * 6. Logs FINAL_BILLING_REPORT to audit trail
 * 7. Updates execution metadata in DB
 * 8. Returns final response
 */
import { CostAttributor } from "./cost-attributor";
import { BillingReporter, type ExecutionData } from "./billing-reporter";
import { ResponseSerializer } from "./response-serializer";
import { ResultCache } from "./result-cache";
import { AuditLogger } from "./audit-logger";
import type { AguiResponse, ToolResult, AgentDecision } from "./types";

/**
 * Phase 5 execution result
 */
export interface Phase5Result {
  response: AguiResponse;
  cached: boolean;
}

/**
 * Phase 5 configuration
 */
export const PHASE5_CONFIG = {
  // Phase identifier for audit logging
  PHASE_NAME: "SERIALIZATION",

  // Event names
  EVENTS: {
    COST_CALCULATED: "COST_CALCULATED",
    BILLING_REPORT_GENERATED: "BILLING_REPORT_GENERATED",
    RESPONSE_VALIDATED: "RESPONSE_VALIDATED",
    CACHE_WRITTEN: "CACHE_WRITTEN",
    FINAL_BILLING_REPORT: "FINAL_BILLING_REPORT",
    METADATA_PERSISTED: "METADATA_PERSISTED",
    PHASE_COMPLETE: "PHASE_COMPLETE",
  },

  // Error codes
  ERROR_CODES: {
    VALIDATION_FAILED: "PHASE5_VALIDATION_FAILED",
    CACHE_WRITE_FAILED: "PHASE5_CACHE_WRITE_FAILED",
    BILLING_PERSIST_FAILED: "PHASE5_BILLING_PERSIST_FAILED",
    UNKNOWN_ERROR: "PHASE5_UNKNOWN_ERROR",
  },
};

/**
 * Execution result input for Phase 5
 */
export interface ExecutionResult {
  response: AguiResponse;
  tokensUsed: number;
  toolCalls: ToolResult[];
  decisions: AgentDecision[];
  recursionDepth: number;
  status: string;
  phaseResult: string;
  fromCache: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Phase 5: Serialization orchestrator
 */
export class Phase5Serialization {
  constructor(
    private costAttributor: CostAttributor,
    private billingReporter: BillingReporter,
    private serializer: ResponseSerializer,
    private cache: ResultCache,
    private auditLogger: AuditLogger
  ) {}

  /**
   * Execute Phase 5: Serialization & Cost Attribution
   *
   * @param executionResult - Complete execution result from previous phases
   * @param intentSignature - Intent signature for cache key
   * @param userId - User ID
   * @param startTime - Execution start timestamp (ms)
   * @returns Phase 5 result with final response
   */
  async execute(
    executionResult: ExecutionResult,
    intentSignature: string,
    userId: string,
    startTime: number
  ): Promise<Phase5Result> {
    const correlationId = executionResult.response.correlationId;
    let cacheWritten = false;

    try {
      // Calculate execution time
      const executionTime = Date.now() - startTime;

      // Step 1: Calculate total cost
      const costBreakdown = this.costAttributor.calculateCostBreakdown({
        tokensUsed: executionResult.tokensUsed,
        toolCalls: executionResult.toolCalls,
        decisions: executionResult.decisions,
      });

      // Audit: Cost calculated
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE5_CONFIG.PHASE_NAME,
        event: PHASE5_CONFIG.EVENTS.COST_CALCULATED,
        details: {
          tokenCost: costBreakdown.tokenCost,
          toolCost: costBreakdown.toolCost,
          totalCost: costBreakdown.totalCost,
          tokensUsed: executionResult.tokensUsed,
          toolCallsCount: executionResult.toolCalls.length,
        },
      });

      // Step 2: Generate billing report
      const billingReport = await this.billingReporter.generateReport(
        correlationId,
        userId,
        {
          tokensUsed: executionResult.tokensUsed,
          toolCalls: executionResult.toolCalls,
          decisions: executionResult.decisions,
          recursionDepth: executionResult.recursionDepth,
          executionTime,
          status: executionResult.status,
          phaseResult: executionResult.phaseResult,
          fromCache: executionResult.fromCache,
          error: executionResult.error,
        }
      );

      // Audit: Billing report generated
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE5_CONFIG.PHASE_NAME,
        event: PHASE5_CONFIG.EVENTS.BILLING_REPORT_GENERATED,
        details: {
          totalCost: billingReport.totalCost,
          metrics: billingReport.metrics,
        },
      });

      // Step 3: Enrich response with cost metadata
      const enrichedResponse = this.serializer.enrich(
        executionResult.response,
        {
          costBreakdown,
          billingReport,
        }
      );

      // Update execution time in response
      enrichedResponse.executionTime = executionTime;

      // Step 4: Validate response
      const validationResult =
        this.serializer.validateWithErrors(enrichedResponse);

      if (!validationResult.valid) {
        throw new Error(
          `Response validation failed: ${JSON.stringify(
            validationResult.errors
          )}`
        );
      }

      // Audit: Response validated
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE5_CONFIG.PHASE_NAME,
        event: PHASE5_CONFIG.EVENTS.RESPONSE_VALIDATED,
        details: {
          status: enrichedResponse.status,
          phaseResult: enrichedResponse.phaseResult,
          fromCache: enrichedResponse.fromCache,
        },
      });

      // Step 5: Write to cache (BEFORE returning - critical!)
      // Only cache successful executions
      if (
        enrichedResponse.status === "COMPLETE" &&
        !enrichedResponse.fromCache
      ) {
        try {
          await this.cache.write(
            intentSignature,
            userId,
            enrichedResponse
          );

          cacheWritten = true;

          // Audit: Cache written
          await this.auditLogger.log({
            correlationId,
            userId,
            phase: PHASE5_CONFIG.PHASE_NAME,
            event: PHASE5_CONFIG.EVENTS.CACHE_WRITTEN,
            details: {
              intentSignature,
            },
          });
        } catch (error) {
          // Log but don't fail - cache write failure shouldn't break execution
          console.error("Cache write failed:", error);

          await this.auditLogger.log({
            correlationId,
            userId,
            phase: PHASE5_CONFIG.PHASE_NAME,
            event: "CACHE_WRITE_ERROR",
            details: {
              error:
                error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      // Step 6: Log FINAL_BILLING_REPORT to audit trail
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE5_CONFIG.PHASE_NAME,
        event: PHASE5_CONFIG.EVENTS.FINAL_BILLING_REPORT,
        details: {
          totalCost: billingReport.totalCost,
          costBreakdown: {
            tokenCost: costBreakdown.tokenCost,
            toolCost: costBreakdown.toolCost,
            totalCost: costBreakdown.totalCost,
          },
          metrics: billingReport.metrics,
          executionTime,
        },
      });

      // Step 7: Update execution metadata in DB
      try {
        await this.billingReporter.persistReport(
          billingReport,
          intentSignature,
          {
            tokensUsed: executionResult.tokensUsed,
            toolCalls: executionResult.toolCalls,
            decisions: executionResult.decisions,
            recursionDepth: executionResult.recursionDepth,
            executionTime,
            status: executionResult.status,
            phaseResult: executionResult.phaseResult,
            fromCache: executionResult.fromCache,
            error: executionResult.error,
          }
        );

        // Audit: Metadata persisted
        await this.auditLogger.log({
          correlationId,
          userId,
          phase: PHASE5_CONFIG.PHASE_NAME,
          event: PHASE5_CONFIG.EVENTS.METADATA_PERSISTED,
          details: {
            correlationId,
            intentSignature,
          },
        });
      } catch (error) {
        // Log but don't fail - metadata persistence failure shouldn't break execution
        console.error("Billing report persistence failed:", error);

        await this.auditLogger.log({
          correlationId,
          userId,
          phase: PHASE5_CONFIG.PHASE_NAME,
          event: "BILLING_PERSIST_ERROR",
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      // Step 8: Log phase complete
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE5_CONFIG.PHASE_NAME,
        event: PHASE5_CONFIG.EVENTS.PHASE_COMPLETE,
        details: {
          totalCost: billingReport.totalCost,
          executionTime,
          cacheWritten,
        },
      });

      // Return final response
      return {
        response: enrichedResponse,
        cached: cacheWritten,
      };
    } catch (error) {
      // Audit: Phase error
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE5_CONFIG.PHASE_NAME,
        event: "PHASE_ERROR",
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      // Return response even on error, but mark it
      const errorResponse = {
        ...executionResult.response,
        error: {
          code: PHASE5_CONFIG.ERROR_CODES.UNKNOWN_ERROR,
          message:
            error instanceof Error ? error.message : "Unknown error",
          details: error,
        },
      };

      return {
        response: errorResponse,
        cached: false,
      };
    }
  }

  /**
   * Execute Phase 5 for a cached response (minimal processing)
   *
   * @param cachedResponse - Response from cache
   * @param correlationId - New correlation ID for this request
   * @param userId - User ID
   * @param intentSignature - Intent signature
   * @returns Phase 5 result with cached response
   */
  async executeForCachedResponse(
    cachedResponse: AguiResponse,
    correlationId: string,
    userId: string,
    intentSignature: string
  ): Promise<Phase5Result> {
    try {
      // Update correlation ID to match current request
      const updatedResponse = {
        ...cachedResponse,
        correlationId,
        fromCache: true,
      };

      // Validate cached response
      const isValid = this.serializer.validate(updatedResponse);

      if (!isValid) {
        throw new Error("Cached response failed validation");
      }

      // Audit: Cached response returned
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE5_CONFIG.PHASE_NAME,
        event: "CACHED_RESPONSE_RETURNED",
        details: {
          intentSignature,
          originalCorrelationId: cachedResponse.correlationId,
          totalCost: cachedResponse.totalCost,
        },
      });

      return {
        response: updatedResponse,
        cached: true,
      };
    } catch (error) {
      // Audit: Error with cached response
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE5_CONFIG.PHASE_NAME,
        event: "CACHED_RESPONSE_ERROR",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }
}

/**
 * Factory function to create Phase5Serialization instance with default dependencies
 */
export function createPhase5Serialization(): Phase5Serialization {
  return new Phase5Serialization(
    new CostAttributor(),
    new BillingReporter(),
    new ResponseSerializer(),
    new ResultCache(),
    new AuditLogger()
  );
}

/**
 * Singleton instance
 */
export const phase5Serialization = createPhase5Serialization();
