/**
 * Phase 3: Policy & Resource Management
 *
 * Main orchestrator for Phase 3 that:
 * 1. Retrieves user policy via AuthManager
 * 2. Validates context window
 * 3. Checks rate limits
 * 4. Enforces all policy constraints
 * 5. Returns CONTINUE or POLICY_VIOLATION
 */
import type { AguiRunJob, PhaseResult, PolicyConstraints } from "./types";
import { AuthManager } from "./auth-manager";
import { ContextWindowValidator } from "./context-validator";
import { RateLimiter } from "./rate-limiter";
import { PolicyEnforcer } from "./policy-enforcer";
import { AuditLogger } from "./audit-logger";

/**
 * Phase 3 result
 */
export interface Phase3Result {
  phaseResult: PhaseResult;
  policy?: PolicyConstraints;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Phase 3 Configuration
 */
export const PHASE3_CONFIG = {
  // Phase identifier for audit logging
  PHASE_NAME: "POLICY_ENFORCEMENT",

  // Error codes
  ERROR_CODES: {
    POLICY_VIOLATION: "PHASE3_POLICY_VIOLATION",
    RATE_LIMIT_EXCEEDED: "PHASE3_RATE_LIMIT_EXCEEDED",
    CONTEXT_EXCEEDED: "PHASE3_CONTEXT_EXCEEDED",
    RECURSION_EXCEEDED: "PHASE3_RECURSION_EXCEEDED",
    UNKNOWN_ERROR: "PHASE3_UNKNOWN_ERROR",
  },
};

/**
 * Phase 3: Policy & Resource Management
 */
export class Phase3Policy {
  private authManager: AuthManager;
  private contextValidator: ContextWindowValidator;
  private rateLimiter: RateLimiter;
  private policyEnforcer: PolicyEnforcer;
  private auditLogger: AuditLogger;

  constructor(
    authManager?: AuthManager,
    contextValidator?: ContextWindowValidator,
    rateLimiter?: RateLimiter,
    policyEnforcer?: PolicyEnforcer,
    auditLogger?: AuditLogger
  ) {
    this.authManager = authManager || new AuthManager();
    this.contextValidator = contextValidator || new ContextWindowValidator();
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.policyEnforcer =
      policyEnforcer ||
      new PolicyEnforcer(this.contextValidator, this.rateLimiter);
    this.auditLogger = auditLogger || new AuditLogger();
  }

  /**
   * Execute Phase 3: Policy & Resource Management
   *
   * @param validatedJob - Validated job from Phase 1
   * @returns Phase 3 result
   */
  async execute(validatedJob: AguiRunJob): Promise<Phase3Result> {
    const correlationId = validatedJob.correlationId;
    const userId = validatedJob.userId;

    try {
      // Audit: Phase 3 started
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE3_CONFIG.PHASE_NAME,
        event: "PHASE_STARTED",
        details: {
          currentDepth: validatedJob.currentDepth || 0,
          maxDepth: validatedJob.maxDepth,
        },
      });

      // Step 1: Get user policy
      const policy = await this.getUserPolicy(validatedJob);

      // Audit: Policy retrieved
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE3_CONFIG.PHASE_NAME,
        event: "POLICY_RETRIEVED",
        details: {
          maxRecursionDepth: policy.maxRecursionDepth,
          contextWindowLimit: policy.contextWindowLimit,
          maxToolCalls: policy.maxToolCalls,
          rateLimit: policy.rateLimit,
        },
      });

      // Step 2: Enforce policy constraints
      const enforcementResult = await this.policyEnforcer.enforce(
        validatedJob,
        policy
      );

      if (!enforcementResult.allowed) {
        // Policy violation detected
        await this.auditLogger.log({
          correlationId,
          userId,
          phase: PHASE3_CONFIG.PHASE_NAME,
          event: "POLICY_VIOLATION",
          details: {
            violationType: enforcementResult.violationType,
            reason: enforcementResult.reason,
            details: enforcementResult.details,
          },
        });

        return {
          phaseResult: "POLICY_VIOLATION",
          policy,
          error: {
            code: this.getErrorCode(enforcementResult.violationType),
            message: enforcementResult.reason || "Policy violation",
            details: enforcementResult.details,
          },
        };
      }

      // Step 3: Increment rate limit counter
      await this.rateLimiter.incrementCounter(userId);

      // Audit: Policy checks passed
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE3_CONFIG.PHASE_NAME,
        event: "POLICY_CHECKS_PASSED",
        details: {
          policy,
        },
      });

      // All checks passed - proceed to next phase
      return {
        phaseResult: "CONTINUE",
        policy,
      };
    } catch (error) {
      // Audit: Phase error
      await this.auditLogger.log({
        correlationId,
        userId,
        phase: PHASE3_CONFIG.PHASE_NAME,
        event: "PHASE_ERROR",
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      return {
        phaseResult: "ERROR",
        error: {
          code: PHASE3_CONFIG.ERROR_CODES.UNKNOWN_ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
          details: error,
        },
      };
    }
  }

  /**
   * Get user policy from AuthManager
   *
   * @param job - Agent job
   * @returns Policy constraints
   */
  private async getUserPolicy(job: AguiRunJob): Promise<PolicyConstraints> {
    try {
      const policy = await this.authManager.getUserPolicy(job.userId);

      // Override with job-specific limits if provided (and more restrictive)
      if (job.maxDepth && job.maxDepth < policy.maxRecursionDepth) {
        policy.maxRecursionDepth = job.maxDepth;
      }

      if (
        job.contextWindowLimit &&
        job.contextWindowLimit < policy.contextWindowLimit
      ) {
        policy.contextWindowLimit = job.contextWindowLimit;
      }

      return policy;
    } catch (error) {
      console.error("Failed to get user policy:", error);
      throw error;
    }
  }

  /**
   * Map violation type to error code
   *
   * @param violationType - Violation type
   * @returns Error code
   */
  private getErrorCode(violationType?: string): string {
    switch (violationType) {
      case "RATE_LIMIT_EXCEEDED":
        return PHASE3_CONFIG.ERROR_CODES.RATE_LIMIT_EXCEEDED;
      case "CONTEXT_WINDOW_EXCEEDED":
        return PHASE3_CONFIG.ERROR_CODES.CONTEXT_EXCEEDED;
      case "RECURSION_DEPTH_EXCEEDED":
        return PHASE3_CONFIG.ERROR_CODES.RECURSION_EXCEEDED;
      default:
        return PHASE3_CONFIG.ERROR_CODES.POLICY_VIOLATION;
    }
  }
}

/**
 * Singleton instance
 */
export const phase3Policy = new Phase3Policy();
