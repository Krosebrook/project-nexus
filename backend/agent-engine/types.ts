/**
 * Core type definitions for the Autonomous AI Agent Execution Engine
 * Part of the FlashFusion/Cortex-Nexus system
 */

/**
 * Agent Action Types - defines what the agent decides to do next
 */
export type AgentActionType =
  | "LLM_CALL"      // Agent runs another reasoning step (recurse)
  | "TOOL_CALL"     // Agent calls an external function
  | "FINAL_ANSWER"; // Agent provides final response

/**
 * Agent Execution Status - tracks current state of execution
 */
export type AgentStatus =
  // Final states
  | "COMPLETE"           // Execution complete, result is terminal
  | "ERROR"              // Execution failed terminally
  // Intermediate states
  | "NEXT_STEP"          // Agent needs to recurse for more reasoning
  | "TOOL_DISPATCHED"    // Agent called a tool, awaiting result
  | "PARALLEL_PENDING";  // Long-running task submitted, check status later

/**
 * Available tools in the tool registry
 */
export type ToolName =
  | "workflow_orchestrator"  // Runs complex pre-defined workflows
  | "google_search"          // Real-time web search for grounding/RAG
  | "code_executor"          // Executes code in secure sandbox
  | "submit_parallel_job"    // Submits long-running non-blocking job
  | "retrieve_context";      // Searches internal knowledge base

/**
 * Phase execution results
 */
export type PhaseResult =
  | "CONTINUE"         // Proceed to next phase
  | "CACHE_HIT"        // Result found in cache, skip remaining phases
  | "POLICY_VIOLATION" // Policy check failed, terminate
  | "ERROR";           // Error occurred, terminate

/**
 * User tier for policy enforcement
 */
export type UserTier = "free" | "pro" | "enterprise";

/**
 * Job payload for agent execution
 */
export interface AguiRunJob {
  // Core job parameters
  userId: string;
  prompt: string;
  correlationId: string;

  // Execution constraints
  maxDepth?: number;          // Maximum recursion depth (default: 5)
  currentDepth?: number;      // Current recursion level (default: 0)
  contextWindowLimit?: number; // Max tokens allowed (default: 8000)

  // Optional context
  previousContext?: string;   // Context from previous step
  toolResults?: ToolResult[]; // Results from tool calls

  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  toolName: ToolName;
  result: any;
  executionTime?: number;
  cost?: number;
}

/**
 * Agent decision structure
 */
export interface AgentDecision {
  actionType: AgentActionType;
  status: AgentStatus;

  // For LLM_CALL
  nextPrompt?: string;

  // For TOOL_CALL
  toolName?: ToolName;
  toolArguments?: Record<string, any>;

  // For FINAL_ANSWER
  finalAnswer?: string;

  // Reasoning trace
  reasoning?: string;
}

/**
 * Complete agent response
 */
export interface AguiResponse {
  // Request tracking
  correlationId: string;
  jobSignature: string; // Intent signature for idempotency

  // Result
  status: AgentStatus;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };

  // Execution metadata
  phaseResult: PhaseResult;
  fromCache: boolean;
  executionTime: number;
  tokensUsed?: number;
  totalCost?: number;

  // Audit trail
  decisions: AgentDecision[];
  toolCalls: ToolResult[];

  // Timestamps
  startedAt: string;
  completedAt: string;
}

/**
 * Cache entry structure
 */
export interface CacheEntry {
  intentSignature: string;
  response: AguiResponse;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
}

/**
 * Policy constraints
 */
export interface PolicyConstraints {
  maxRecursionDepth: number;
  contextWindowLimit: number;
  maxToolCalls: number;
  allowedTools: ToolName[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  correlationId: string;
  timestamp: Date;
  phase: string;
  event: string;
  details: Record<string, any>;
  userId: string;
}
