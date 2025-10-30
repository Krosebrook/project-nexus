/**
 * Tests for validation schemas
 */
import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  AguiRunJobSchema,
  AguiResponseSchema,
  ToolResultSchema,
  AgentDecisionSchema,
  PolicyConstraintsSchema,
} from "./schemas";

describe("Validation Schemas", () => {
  describe("AguiRunJobSchema", () => {
    const validJob = {
      userId: "user123",
      prompt: "What is the meaning of life?",
      correlationId: "550e8400-e29b-41d4-a716-446655440000",
    };

    it("should validate a minimal valid job", () => {
      const result = AguiRunJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.maxDepth).toBe(5); // Default
        expect(result.data.contextWindowLimit).toBe(8000); // Default
        expect(result.data.currentDepth).toBe(0); // Default
      }
    });

    it("should validate a complete job with all fields", () => {
      const completeJob = {
        ...validJob,
        maxDepth: 10,
        contextWindowLimit: 16000,
        currentDepth: 2,
        previousContext: "Some context",
        toolResults: [
          {
            toolName: "google_search",
            result: "Search result",
            executionTime: 123,
            cost: 0.005,
          },
        ],
        metadata: { key: "value" },
      };

      const result = AguiRunJobSchema.safeParse(completeJob);
      expect(result.success).toBe(true);
    });

    it("should reject missing userId", () => {
      const invalid = { ...validJob };
      delete (invalid as any).userId;

      const result = AguiRunJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject missing prompt", () => {
      const invalid = { ...validJob };
      delete (invalid as any).prompt;

      const result = AguiRunJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid correlationId (not UUID)", () => {
      const invalid = { ...validJob, correlationId: "not-a-uuid" };

      const result = AguiRunJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject empty userId", () => {
      const invalid = { ...validJob, userId: "" };

      const result = AguiRunJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject empty prompt", () => {
      const invalid = { ...validJob, prompt: "" };

      const result = AguiRunJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should enforce maxDepth bounds", () => {
      const tooLow = { ...validJob, maxDepth: 0 };
      const tooHigh = { ...validJob, maxDepth: 21 };

      expect(AguiRunJobSchema.safeParse(tooLow).success).toBe(false);
      expect(AguiRunJobSchema.safeParse(tooHigh).success).toBe(false);
    });

    it("should enforce contextWindowLimit bounds", () => {
      const tooLow = { ...validJob, contextWindowLimit: 50 };
      const tooHigh = { ...validJob, contextWindowLimit: 200000 };

      expect(AguiRunJobSchema.safeParse(tooLow).success).toBe(false);
      expect(AguiRunJobSchema.safeParse(tooHigh).success).toBe(false);
    });

    it("should reject extra fields (strict mode)", () => {
      const withExtra = { ...validJob, extraField: "not allowed" };

      const result = AguiRunJobSchema.safeParse(withExtra);
      expect(result.success).toBe(false);
    });
  });

  describe("ToolResultSchema", () => {
    it("should validate a minimal tool result", () => {
      const toolResult = {
        toolName: "google_search",
        result: "Some result",
      };

      const result = ToolResultSchema.safeParse(toolResult);
      expect(result.success).toBe(true);
    });

    it("should validate a complete tool result", () => {
      const toolResult = {
        toolName: "code_executor",
        result: { output: "success" },
        executionTime: 456,
        cost: 0.002,
      };

      const result = ToolResultSchema.safeParse(toolResult);
      expect(result.success).toBe(true);
    });

    it("should reject invalid tool names", () => {
      const invalid = {
        toolName: "invalid_tool",
        result: "result",
      };

      const result = ToolResultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should accept all valid tool names", () => {
      const validTools = [
        "workflow_orchestrator",
        "google_search",
        "code_executor",
        "submit_parallel_job",
        "retrieve_context",
      ];

      validTools.forEach((toolName) => {
        const result = ToolResultSchema.safeParse({
          toolName,
          result: "test",
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("AgentDecisionSchema", () => {
    it("should validate LLM_CALL decision", () => {
      const decision = {
        actionType: "LLM_CALL",
        status: "NEXT_STEP",
        nextPrompt: "Continue reasoning...",
        reasoning: "Need more information",
      };

      const result = AgentDecisionSchema.safeParse(decision);
      expect(result.success).toBe(true);
    });

    it("should validate TOOL_CALL decision", () => {
      const decision = {
        actionType: "TOOL_CALL",
        status: "TOOL_DISPATCHED",
        toolName: "google_search",
        toolArguments: { query: "test" },
      };

      const result = AgentDecisionSchema.safeParse(decision);
      expect(result.success).toBe(true);
    });

    it("should validate FINAL_ANSWER decision", () => {
      const decision = {
        actionType: "FINAL_ANSWER",
        status: "COMPLETE",
        finalAnswer: "The answer is 42",
      };

      const result = AgentDecisionSchema.safeParse(decision);
      expect(result.success).toBe(true);
    });

    it("should reject invalid action types", () => {
      const invalid = {
        actionType: "INVALID_ACTION",
        status: "COMPLETE",
      };

      const result = AgentDecisionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid status", () => {
      const invalid = {
        actionType: "FINAL_ANSWER",
        status: "INVALID_STATUS",
      };

      const result = AgentDecisionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("AguiResponseSchema", () => {
    const validResponse = {
      correlationId: "550e8400-e29b-41d4-a716-446655440000",
      jobSignature: "a".repeat(64),
      status: "COMPLETE",
      phaseResult: "CONTINUE",
      fromCache: false,
      executionTime: 1234,
      decisions: [],
      toolCalls: [],
      startedAt: "2025-01-01T00:00:00.000Z",
      completedAt: "2025-01-01T00:00:01.234Z",
    };

    it("should validate a minimal valid response", () => {
      const result = AguiResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("should validate a complete response with all fields", () => {
      const completeResponse = {
        ...validResponse,
        result: { answer: "42" },
        error: {
          code: "ERROR_CODE",
          message: "Error message",
          details: { extra: "info" },
        },
        tokensUsed: 500,
        totalCost: 0.001,
        decisions: [
          {
            actionType: "LLM_CALL",
            status: "NEXT_STEP",
            nextPrompt: "test",
          },
        ],
        toolCalls: [
          {
            toolName: "google_search",
            result: "result",
          },
        ],
      };

      const result = AguiResponseSchema.safeParse(completeResponse);
      expect(result.success).toBe(true);
    });

    it("should reject invalid correlationId", () => {
      const invalid = { ...validResponse, correlationId: "not-uuid" };

      const result = AguiResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid datetime format", () => {
      const invalid = { ...validResponse, startedAt: "not-a-date" };

      const result = AguiResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("PolicyConstraintsSchema", () => {
    const validPolicy = {
      maxRecursionDepth: 5,
      contextWindowLimit: 8000,
      maxToolCalls: 10,
      allowedTools: ["google_search", "code_executor"],
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
      },
    };

    it("should validate valid policy constraints", () => {
      const result = PolicyConstraintsSchema.safeParse(validPolicy);
      expect(result.success).toBe(true);
    });

    it("should reject negative values", () => {
      const invalid = { ...validPolicy, maxRecursionDepth: -1 };

      const result = PolicyConstraintsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject zero values", () => {
      const invalid = { ...validPolicy, maxToolCalls: 0 };

      const result = PolicyConstraintsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid tool names in allowedTools", () => {
      const invalid = { ...validPolicy, allowedTools: ["invalid_tool"] };

      const result = PolicyConstraintsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should accept empty allowedTools array", () => {
      const valid = { ...validPolicy, allowedTools: [] };

      const result = PolicyConstraintsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});
