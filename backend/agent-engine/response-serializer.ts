/**
 * Response Serializer
 *
 * Handles serialization, deserialization, enrichment, and validation
 * of agent execution responses.
 */
import { ZodError } from "zod";
import { AguiResponseSchema } from "./schemas";
import type { AguiResponse } from "./types";
import type { CostBreakdown } from "./cost-attributor";
import type { BillingReport } from "./billing-reporter";

/**
 * Response metadata for enrichment
 */
export interface ResponseMetadata {
  costBreakdown?: CostBreakdown;
  billingReport?: BillingReport;
  additionalMetadata?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * ResponseSerializer - handles response serialization and validation
 */
export class ResponseSerializer {
  /**
   * Serialize an AguiResponse to JSON string
   *
   * @param response - Response to serialize
   * @returns JSON string representation
   */
  serialize(response: AguiResponse): string {
    try {
      // Format with 2-space indentation for readability
      return JSON.stringify(response, null, 2);
    } catch (error) {
      throw new Error(
        `Failed to serialize response: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Serialize response in compact format (no formatting)
   *
   * @param response - Response to serialize
   * @returns Compact JSON string
   */
  serializeCompact(response: AguiResponse): string {
    try {
      return JSON.stringify(response);
    } catch (error) {
      throw new Error(
        `Failed to serialize response: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Deserialize JSON string to AguiResponse
   *
   * @param json - JSON string to deserialize
   * @returns Parsed and validated AguiResponse
   */
  deserialize(json: string): AguiResponse {
    try {
      // Parse JSON
      const parsed = JSON.parse(json);

      // Validate against schema
      const validated = AguiResponseSchema.parse(parsed);

      return validated as AguiResponse;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(
          `Response validation failed: ${error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", ")}`
        );
      }

      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }

      throw new Error(
        `Failed to deserialize response: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Enrich response with additional metadata
   *
   * @param response - Original response
   * @param metadata - Metadata to add
   * @returns Enriched response
   */
  enrich(response: AguiResponse, metadata: ResponseMetadata): AguiResponse {
    const enriched = { ...response };

    // Add cost breakdown if provided
    if (metadata.costBreakdown) {
      enriched.totalCost = metadata.costBreakdown.totalCost;
      enriched.tokensUsed = metadata.costBreakdown.breakdown.reduce(
        (sum, phase) => sum + (phase.tokens || 0),
        0
      );
    }

    // Add billing report data if provided
    if (metadata.billingReport) {
      enriched.totalCost = metadata.billingReport.totalCost;
      enriched.tokensUsed = metadata.billingReport.metrics.tokensUsed;
    }

    // Add any additional metadata to the response
    // Note: We don't modify the schema, but we can add to existing fields
    if (metadata.additionalMetadata) {
      // Could be stored in decisions or toolCalls details if needed
      // For now, we ensure the core cost fields are populated
    }

    return enriched;
  }

  /**
   * Validate response against schema
   *
   * @param response - Response to validate
   * @returns Validation result
   */
  validate(response: AguiResponse): boolean {
    try {
      AguiResponseSchema.parse(response);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Response validation failed:", {
          errors: error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
            code: e.code,
          })),
        });
      }
      return false;
    }
  }

  /**
   * Validate response and return detailed errors
   *
   * @param response - Response to validate
   * @returns Detailed validation result
   */
  validateWithErrors(response: AguiResponse): ValidationResult {
    try {
      AguiResponseSchema.parse(response);
      return { valid: true };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
            code: e.code,
          })),
        };
      }

      return {
        valid: false,
        errors: [
          {
            path: "unknown",
            message:
              error instanceof Error ? error.message : "Unknown error",
            code: "UNKNOWN_ERROR",
          },
        ],
      };
    }
  }

  /**
   * Create a minimal response structure (for error cases)
   *
   * @param correlationId - Correlation ID
   * @param jobSignature - Job signature
   * @param status - Agent status
   * @param error - Error details
   * @returns Minimal valid response
   */
  createErrorResponse(
    correlationId: string,
    jobSignature: string,
    status: string,
    error: {
      code: string;
      message: string;
      details?: any;
    }
  ): AguiResponse {
    const now = new Date().toISOString();

    return {
      correlationId,
      jobSignature,
      status: status as any,
      error,
      phaseResult: "ERROR",
      fromCache: false,
      executionTime: 0,
      decisions: [],
      toolCalls: [],
      startedAt: now,
      completedAt: now,
    };
  }

  /**
   * Clone a response (deep copy)
   *
   * @param response - Response to clone
   * @returns Cloned response
   */
  clone(response: AguiResponse): AguiResponse {
    try {
      // Serialize and deserialize for deep copy
      const serialized = this.serializeCompact(response);
      return this.deserialize(serialized);
    } catch (error) {
      throw new Error(
        `Failed to clone response: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Sanitize response for logging (remove sensitive data)
   *
   * @param response - Response to sanitize
   * @returns Sanitized response
   */
  sanitize(response: AguiResponse): AguiResponse {
    const sanitized = this.clone(response);

    // Remove potentially sensitive data from tool results
    sanitized.toolCalls = sanitized.toolCalls.map((tool) => ({
      ...tool,
      result: "[SANITIZED]",
    }));

    // Remove potentially sensitive data from decisions
    sanitized.decisions = sanitized.decisions.map((decision) => ({
      ...decision,
      toolArguments: decision.toolArguments
        ? { "[SANITIZED]": true }
        : undefined,
    }));

    return sanitized;
  }

  /**
   * Get response summary for logging
   *
   * @param response - Response to summarize
   * @returns Summary object
   */
  summarize(response: AguiResponse): {
    correlationId: string;
    status: string;
    phaseResult: string;
    fromCache: boolean;
    executionTime: number;
    totalCost?: number;
    tokensUsed?: number;
    toolCallsCount: number;
    decisionsCount: number;
    hasError: boolean;
  } {
    return {
      correlationId: response.correlationId,
      status: response.status,
      phaseResult: response.phaseResult,
      fromCache: response.fromCache,
      executionTime: response.executionTime,
      totalCost: response.totalCost,
      tokensUsed: response.tokensUsed,
      toolCallsCount: response.toolCalls.length,
      decisionsCount: response.decisions.length,
      hasError: !!response.error,
    };
  }

  /**
   * Convert response to HTTP-friendly format
   *
   * @param response - Response to convert
   * @returns HTTP response object
   */
  toHttpResponse(response: AguiResponse): {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  } {
    const statusCode = response.error ? 500 : 200;

    return {
      statusCode,
      body: this.serialize(response),
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": response.correlationId,
        "X-Cache-Hit": response.fromCache.toString(),
        "X-Execution-Time": response.executionTime.toString(),
      },
    };
  }
}

/**
 * Singleton instance
 */
export const responseSerializer = new ResponseSerializer();
