/**
 * Phase 1: Ingestion
 *
 * The entry point for all agent execution requests.
 * Handles:
 * 1. Validation of the raw payload against AguiRunJobSchema
 * 2. Idempotency via Intent Signature calculation
 * 3. Cache lookup - returns cached response if valid
 *
 * Returns either:
 * - CACHE_HIT with cached response (skip Phases 2-5)
 * - CONTINUE to proceed to Phase 2
 * - ERROR if validation fails
 */
import { ZodError } from "zod";
import { AguiRunJobSchema } from "./schemas";
import { calculateIntentSignature, getShortSignature } from "./idempotency";
import { resultCache } from "./result-cache";
import type { AguiRunJob, AguiResponse, PhaseResult } from "./types";
import { AuditLogger } from "./audit-logger";

/**
 * Phase 1 execution result
 */
export interface Phase1Result {
  phaseResult: PhaseResult;
  validatedJob?: AguiRunJob;
  intentSignature?: string;
  cachedResponse?: AguiResponse;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Phase 1 Configuration
 */
export const PHASE1_CONFIG = {
  // Phase identifier for audit logging
  PHASE_NAME: "INGESTION",

  // Error codes
  ERROR_CODES: {
    VALIDATION_FAILED: "PHASE1_VALIDATION_FAILED",
    CACHE_ERROR: "PHASE1_CACHE_ERROR",
    UNKNOWN_ERROR: "PHASE1_UNKNOWN_ERROR",
  },
};

/**
 * Phase 1: Ingestion Orchestrator
 */
export class Phase1Ingestion {
  private auditLogger: AuditLogger;

  constructor() {
    this.auditLogger = new AuditLogger();
  }

  /**
   * Execute Phase 1: Ingestion
   *
   * @param rawPayload - Unvalidated raw payload from client
   * @returns Phase 1 result with validation, signature, and cache lookup
   */
  async execute(rawPayload: unknown): Promise<Phase1Result> {
    let correlationId = "unknown";

    try {
      // Step 1: Validation
      const validationResult = await this.validatePayload(rawPayload);

      if (!validationResult.success) {
        return {
          phaseResult: "ERROR",
          error: validationResult.error,
        };
      }

      const validatedJob = validationResult.job!;
      correlationId = validatedJob.correlationId;

      // Audit: Validation success
      await this.auditLogger.log({
        correlationId,
        userId: validatedJob.userId,
        phase: PHASE1_CONFIG.PHASE_NAME,
        event: "VALIDATION_SUCCESS",
        details: {
          userId: validatedJob.userId,
          promptLength: validatedJob.prompt.length,
          maxDepth: validatedJob.maxDepth,
          contextWindowLimit: validatedJob.contextWindowLimit,
        },
      });

      // Step 2: Calculate Intent Signature
      const intentSignature = calculateIntentSignature(validatedJob);

      // Audit: Signature calculated
      await this.auditLogger.log({
        correlationId,
        userId: validatedJob.userId,
        phase: PHASE1_CONFIG.PHASE_NAME,
        event: "SIGNATURE_CALCULATED",
        details: {
          intentSignature,
          shortSignature: getShortSignature(intentSignature),
        },
      });

      // Step 3: Cache Lookup
      const cacheResult = await this.cacheLookup(
        intentSignature,
        validatedJob.userId,
        correlationId
      );

      if (cacheResult.hit) {
        // Audit: Cache hit
        await this.auditLogger.log({
          correlationId,
          userId: validatedJob.userId,
          phase: PHASE1_CONFIG.PHASE_NAME,
          event: "CACHE_HIT",
          details: {
            intentSignature,
            cacheAge: cacheResult.age,
          },
        });

        return {
          phaseResult: "CACHE_HIT",
          validatedJob,
          intentSignature,
          cachedResponse: cacheResult.response,
        };
      }

      // Audit: Cache miss
      await this.auditLogger.log({
        correlationId,
        userId: validatedJob.userId,
        phase: PHASE1_CONFIG.PHASE_NAME,
        event: "CACHE_MISS",
        details: {
          intentSignature,
        },
      });

      // Continue to Phase 2
      return {
        phaseResult: "CONTINUE",
        validatedJob,
        intentSignature,
      };
    } catch (error) {
      // Audit: Unexpected error
      await this.auditLogger.log({
        correlationId,
        userId: "unknown",
        phase: PHASE1_CONFIG.PHASE_NAME,
        event: "PHASE_ERROR",
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      return {
        phaseResult: "ERROR",
        error: {
          code: PHASE1_CONFIG.ERROR_CODES.UNKNOWN_ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
          details: error,
        },
      };
    }
  }

  /**
   * Validate the raw payload against AguiRunJobSchema
   *
   * @param rawPayload - Unvalidated payload
   * @returns Validation result
   */
  private async validatePayload(rawPayload: unknown): Promise<{
    success: boolean;
    job?: AguiRunJob;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
  }> {
    try {
      const validatedJob = AguiRunJobSchema.parse(rawPayload);

      return {
        success: true,
        job: validatedJob as AguiRunJob,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          error: {
            code: PHASE1_CONFIG.ERROR_CODES.VALIDATION_FAILED,
            message: "Payload validation failed",
            details: {
              issues: error.errors.map((err) => ({
                path: err.path.join("."),
                message: err.message,
                code: err.code,
              })),
            },
          },
        };
      }

      return {
        success: false,
        error: {
          code: PHASE1_CONFIG.ERROR_CODES.VALIDATION_FAILED,
          message: error instanceof Error ? error.message : "Validation failed",
          details: error,
        },
      };
    }
  }

  /**
   * Perform cache lookup
   *
   * @param intentSignature - Intent signature
   * @param userId - User ID
   * @param correlationId - Correlation ID for audit
   * @returns Cache lookup result
   */
  private async cacheLookup(
    intentSignature: string,
    userId: string,
    correlationId: string
  ): Promise<{
    hit: boolean;
    response?: AguiResponse;
    age?: number;
  }> {
    try {
      const result = await resultCache.lookup(intentSignature, userId);

      return result;
    } catch (error) {
      // Log but don't fail - treat as cache miss
      console.error("Cache lookup error:", error);

      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE1_CONFIG.PHASE_NAME,
        event: "CACHE_ERROR",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return { hit: false };
    }
  }
}

/**
 * Singleton instance
 */
export const phase1Ingestion = new Phase1Ingestion();
