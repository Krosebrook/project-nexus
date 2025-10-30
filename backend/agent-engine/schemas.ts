/**
 * Zod validation schemas for the Agent Execution Engine
 */
import { z } from "zod";
import type {
  AgentActionType,
  AgentStatus,
  ToolName,
  PhaseResult,
  UserTier
} from "./types";

/**
 * Tool name validation
 */
export const ToolNameSchema = z.enum([
  "workflow_orchestrator",
  "google_search",
  "code_executor",
  "submit_parallel_job",
  "retrieve_context"
]);

/**
 * Agent action type validation
 */
export const AgentActionTypeSchema = z.enum([
  "LLM_CALL",
  "TOOL_CALL",
  "FINAL_ANSWER"
]);

/**
 * Agent status validation
 */
export const AgentStatusSchema = z.enum([
  "COMPLETE",
  "ERROR",
  "NEXT_STEP",
  "TOOL_DISPATCHED",
  "PARALLEL_PENDING"
]);

/**
 * Phase result validation
 */
export const PhaseResultSchema = z.enum([
  "CONTINUE",
  "CACHE_HIT",
  "POLICY_VIOLATION",
  "ERROR"
]);

/**
 * User tier validation
 */
export const UserTierSchema = z.enum(["free", "pro", "enterprise"]);

/**
 * Tool result schema
 */
export const ToolResultSchema = z.object({
  toolName: ToolNameSchema,
  result: z.any(),
  executionTime: z.number().optional(),
  cost: z.number().optional()
});

/**
 * Agent decision schema
 */
export const AgentDecisionSchema = z.object({
  actionType: AgentActionTypeSchema,
  status: AgentStatusSchema,
  nextPrompt: z.string().optional(),
  toolName: ToolNameSchema.optional(),
  toolArguments: z.record(z.any()).optional(),
  finalAnswer: z.string().optional(),
  reasoning: z.string().optional()
});

/**
 * Main job payload schema - validates incoming requests
 * This is the AguiRunJobSchema mentioned in the spec
 */
export const AguiRunJobSchema = z.object({
  // Core parameters (stable - used for intent signature)
  userId: z.string().min(1, "userId is required"),
  prompt: z.string().min(1, "prompt is required"),

  // Execution constraints (stable - used for intent signature)
  maxDepth: z.number().int().min(1).max(20).default(5),
  contextWindowLimit: z.number().int().min(100).max(128000).default(8000),

  // Volatile parameters (excluded from intent signature)
  correlationId: z.string().uuid(),
  currentDepth: z.number().int().min(0).default(0),

  // Optional context
  previousContext: z.string().optional(),
  toolResults: z.array(ToolResultSchema).optional(),

  // Metadata
  metadata: z.record(z.any()).optional()
}).strict();

/**
 * Response error schema
 */
export const ResponseErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional()
});

/**
 * Complete response schema
 */
export const AguiResponseSchema = z.object({
  // Request tracking
  correlationId: z.string().uuid(),
  jobSignature: z.string(),

  // Result
  status: AgentStatusSchema,
  result: z.any().optional(),
  error: ResponseErrorSchema.optional(),

  // Execution metadata
  phaseResult: PhaseResultSchema,
  fromCache: z.boolean(),
  executionTime: z.number(),
  tokensUsed: z.number().optional(),
  totalCost: z.number().optional(),

  // Audit trail
  decisions: z.array(AgentDecisionSchema),
  toolCalls: z.array(ToolResultSchema),

  // Timestamps
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime()
});

/**
 * Policy constraints schema
 */
export const PolicyConstraintsSchema = z.object({
  maxRecursionDepth: z.number().int().positive(),
  contextWindowLimit: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  allowedTools: z.array(ToolNameSchema),
  rateLimit: z.object({
    requestsPerMinute: z.number().int().positive(),
    requestsPerHour: z.number().int().positive()
  })
});

/**
 * Audit log entry schema
 */
export const AuditLogEntrySchema = z.object({
  correlationId: z.string().uuid(),
  timestamp: z.date(),
  phase: z.string(),
  event: z.string(),
  details: z.record(z.any()),
  userId: z.string()
});

/**
 * Type inference helpers
 */
export type AguiRunJobInput = z.infer<typeof AguiRunJobSchema>;
export type AguiResponseOutput = z.infer<typeof AguiResponseSchema>;
export type ToolResultInput = z.infer<typeof ToolResultSchema>;
export type AgentDecisionInput = z.infer<typeof AgentDecisionSchema>;
export type PolicyConstraintsInput = z.infer<typeof PolicyConstraintsSchema>;
