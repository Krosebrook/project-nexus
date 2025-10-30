/**
 * Policy Enforcer
 *
 * Orchestrates all policy checks:
 * - Recursion depth validation
 * - Context window validation
 * - Rate limit checks
 * - Tool allowlist validation
 */
import type { AguiRunJob, PolicyConstraints } from "./types";
import { ContextWindowValidator } from "./context-validator";
import { RateLimiter } from "./rate-limiter";

/**
 * Policy enforcement result
 */
export interface PolicyEnforcementResult {
  allowed: boolean;
  reason?: string;
  violationType?: string;
  details?: any;
}

/**
 * Violation types
 */
export const VIOLATION_TYPES = {
  RECURSION_DEPTH: "RECURSION_DEPTH_EXCEEDED",
  CONTEXT_WINDOW: "CONTEXT_WINDOW_EXCEEDED",
  RATE_LIMIT: "RATE_LIMIT_EXCEEDED",
  TOOL_NOT_ALLOWED: "TOOL_NOT_ALLOWED",
  TOOL_CALLS_EXCEEDED: "TOOL_CALLS_EXCEEDED",
} as const;

/**
 * Policy Enforcer - orchestrates all policy checks
 */
export class PolicyEnforcer {
  private contextValidator: ContextWindowValidator;
  private rateLimiter: RateLimiter;

  constructor(
    contextValidator?: ContextWindowValidator,
    rateLimiter?: RateLimiter
  ) {
    this.contextValidator = contextValidator || new ContextWindowValidator();
    this.rateLimiter = rateLimiter || new RateLimiter();
  }

  /**
   * Enforce all policy constraints
   *
   * @param job - Agent job to validate
   * @param policy - Policy constraints to enforce
   * @returns Policy enforcement result
   */
  async enforce(
    job: AguiRunJob,
    policy: PolicyConstraints
  ): Promise<PolicyEnforcementResult> {
    try {
      // Check 1: Recursion depth
      const depthCheck = this.checkRecursionDepth(job, policy);
      if (!depthCheck.allowed) {
        return depthCheck;
      }

      // Check 2: Context window
      const contextCheck = this.checkContextWindow(job, policy);
      if (!contextCheck.allowed) {
        return contextCheck;
      }

      // Check 3: Rate limits
      const rateLimitCheck = await this.checkRateLimit(job, policy);
      if (!rateLimitCheck.allowed) {
        return rateLimitCheck;
      }

      // Check 4: Tool calls count
      const toolCountCheck = this.checkToolCallsCount(job, policy);
      if (!toolCountCheck.allowed) {
        return toolCountCheck;
      }

      // Check 5: Tool allowlist (if specified)
      const toolAllowlistCheck = this.checkToolAllowlist(job, policy);
      if (!toolAllowlistCheck.allowed) {
        return toolAllowlistCheck;
      }

      // All checks passed
      return {
        allowed: true,
      };
    } catch (error) {
      console.error("Policy enforcement error:", error);

      return {
        allowed: false,
        reason: "Policy enforcement failed",
        violationType: "INTERNAL_ERROR",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Check recursion depth constraint
   *
   * @param job - Agent job
   * @param policy - Policy constraints
   * @returns Enforcement result
   */
  private checkRecursionDepth(
    job: AguiRunJob,
    policy: PolicyConstraints
  ): PolicyEnforcementResult {
    const currentDepth = job.currentDepth || 0;
    const maxDepth = policy.maxRecursionDepth;

    if (currentDepth >= maxDepth) {
      return {
        allowed: false,
        reason: `Recursion depth limit exceeded: ${currentDepth} >= ${maxDepth}`,
        violationType: VIOLATION_TYPES.RECURSION_DEPTH,
        details: {
          currentDepth,
          maxDepth,
        },
      };
    }

    return { allowed: true };
  }

  /**
   * Check context window constraint
   *
   * @param job - Agent job
   * @param policy - Policy constraints
   * @returns Enforcement result
   */
  private checkContextWindow(
    job: AguiRunJob,
    policy: PolicyConstraints
  ): PolicyEnforcementResult {
    // Combine prompt and previous context
    const texts = [job.prompt];
    if (job.previousContext) {
      texts.push(job.previousContext);
    }

    const validation = this.contextValidator.validateMultipleTexts(
      texts,
      policy.contextWindowLimit
    );

    if (!validation.valid) {
      return {
        allowed: false,
        reason: validation.message || "Context window limit exceeded",
        violationType: VIOLATION_TYPES.CONTEXT_WINDOW,
        details: {
          estimated: validation.estimated,
          limit: validation.limit,
        },
      };
    }

    return { allowed: true };
  }

  /**
   * Check rate limit constraint
   *
   * @param job - Agent job
   * @param policy - Policy constraints
   * @returns Enforcement result
   */
  private async checkRateLimit(
    job: AguiRunJob,
    policy: PolicyConstraints
  ): Promise<PolicyEnforcementResult> {
    const rateLimitResult = await this.rateLimiter.checkRateLimit(
      job.userId,
      policy.rateLimit
    );

    if (!rateLimitResult.allowed) {
      return {
        allowed: false,
        reason: rateLimitResult.reason || "Rate limit exceeded",
        violationType: VIOLATION_TYPES.RATE_LIMIT,
        details: {
          remaining: rateLimitResult.remaining,
        },
      };
    }

    return { allowed: true };
  }

  /**
   * Check tool calls count constraint
   *
   * @param job - Agent job
   * @param policy - Policy constraints
   * @returns Enforcement result
   */
  private checkToolCallsCount(
    job: AguiRunJob,
    policy: PolicyConstraints
  ): PolicyEnforcementResult {
    const toolCallsCount = job.toolResults?.length || 0;
    const maxToolCalls = policy.maxToolCalls;

    if (toolCallsCount >= maxToolCalls) {
      return {
        allowed: false,
        reason: `Tool calls limit exceeded: ${toolCallsCount} >= ${maxToolCalls}`,
        violationType: VIOLATION_TYPES.TOOL_CALLS_EXCEEDED,
        details: {
          toolCallsCount,
          maxToolCalls,
        },
      };
    }

    return { allowed: true };
  }

  /**
   * Check tool allowlist constraint
   *
   * @param job - Agent job
   * @param policy - Policy constraints
   * @returns Enforcement result
   */
  private checkToolAllowlist(
    job: AguiRunJob,
    policy: PolicyConstraints
  ): PolicyEnforcementResult {
    // If no allowlist is specified, all tools are allowed
    if (!policy.allowedTools || policy.allowedTools.length === 0) {
      return { allowed: true };
    }

    // Check if any tool results contain disallowed tools
    if (job.toolResults && job.toolResults.length > 0) {
      const disallowedTools = job.toolResults.filter(
        (result) => !policy.allowedTools.includes(result.toolName)
      );

      if (disallowedTools.length > 0) {
        const toolNames = disallowedTools.map((t) => t.toolName).join(", ");

        return {
          allowed: false,
          reason: `Tool not allowed: ${toolNames}`,
          violationType: VIOLATION_TYPES.TOOL_NOT_ALLOWED,
          details: {
            disallowedTools: toolNames,
            allowedTools: policy.allowedTools,
          },
        };
      }
    }

    return { allowed: true };
  }
}

/**
 * Singleton instance
 */
export const policyEnforcer = new PolicyEnforcer();
