/**
 * LLM Prompt Templates for Agent Reasoning
 * Provides structured prompts for the agent execution engine
 */

import { ToolName } from "./types";

export class LLMPrompts {
  /**
   * Get the system prompt that defines the agent's role and capabilities
   */
  static getSystemPrompt(): string {
    return `You are an autonomous AI agent in the FlashFusion/Cortex-Nexus execution engine.

Your role is to reason about user requests and decide what action to take next.

Available Actions:
1. LLM_CALL - Continue reasoning by making another LLM call (recursive thinking)
2. TOOL_CALL - Execute an external tool to gather information or perform an action
3. FINAL_ANSWER - Provide the final answer to the user's request

Response Format:
You must respond with a JSON object containing:
{
  "actionType": "LLM_CALL" | "TOOL_CALL" | "FINAL_ANSWER",
  "reasoning": "Your chain-of-thought reasoning explaining your decision",
  "nextPrompt": "The next prompt for recursive reasoning (if LLM_CALL)",
  "toolName": "The tool to call (if TOOL_CALL)",
  "toolArguments": { "key": "value" } (if TOOL_CALL),
  "finalAnswer": "Your final answer to the user (if FINAL_ANSWER)"
}

Guidelines:
- Use chain-of-thought reasoning to break down complex problems
- Make incremental progress with each reasoning step
- Call tools when you need external information or capabilities
- Provide a final answer only when you have sufficient information
- Be concise but thorough in your reasoning
- Avoid unnecessary recursion - aim for efficiency`;
  }

  /**
   * Get a chain-of-thought prompt with context
   * @param context - The context to reason about
   */
  static getChainOfThoughtPrompt(context: string): string {
    return `Given the following context, think step-by-step about what to do next.

Context:
${context}

Use chain-of-thought reasoning:
1. What information do I have?
2. What information do I need?
3. What should I do next?
4. What action should I take?

Provide your reasoning and next action in JSON format as specified in the system prompt.`;
  }

  /**
   * Get a tool selection prompt
   * @param tools - Available tools
   */
  static getToolSelectionPrompt(tools: ToolName[]): string {
    const toolDescriptions: Record<ToolName, string> = {
      workflow_orchestrator: "Runs complex pre-defined workflows",
      google_search: "Real-time web search for grounding/RAG",
      code_executor: "Executes code in a secure sandbox",
      submit_parallel_job: "Submits long-running non-blocking job",
      retrieve_context: "Searches internal knowledge base",
    };

    const availableTools = tools
      .map((tool) => `- ${tool}: ${toolDescriptions[tool]}`)
      .join("\n");

    return `Available Tools:
${availableTools}

Select the most appropriate tool for the current task.
Consider:
- What information or capability is needed?
- Which tool best provides that capability?
- Are there any dependencies or prerequisites?

Provide your tool selection and arguments in JSON format as specified in the system prompt.`;
  }

  /**
   * Get a final answer prompt
   */
  static getFinalAnswerPrompt(): string {
    return `You have gathered sufficient information to answer the user's request.

Provide a clear, concise, and complete final answer.

Requirements:
- Address all aspects of the user's original request
- Be factual and accurate
- Cite sources if you used external information
- Be clear about any limitations or uncertainties

Format your response as a JSON object with actionType: "FINAL_ANSWER" and your answer in the finalAnswer field.`;
  }

  /**
   * Get a prompt for handling tool results
   * @param toolName - The tool that was called
   * @param toolResult - The result from the tool
   */
  static getToolResultPrompt(toolName: ToolName, toolResult: any): string {
    return `The ${toolName} tool has returned the following result:

${JSON.stringify(toolResult, null, 2)}

Analyze this result and decide what to do next:
- Do you need to call another tool?
- Do you need more reasoning?
- Are you ready to provide a final answer?

Provide your decision in JSON format as specified in the system prompt.`;
  }

  /**
   * Get a prompt for handling errors
   * @param errorMessage - The error message
   */
  static getErrorHandlingPrompt(errorMessage: string): string {
    return `An error occurred during execution:

${errorMessage}

Consider:
- Can you work around this error?
- Do you need to try a different approach?
- Should you provide a partial answer with limitations?

Decide how to proceed and provide your decision in JSON format as specified in the system prompt.`;
  }

  /**
   * Get a prompt for checking recursion depth
   * @param currentDepth - Current recursion depth
   * @param maxDepth - Maximum allowed depth
   */
  static getDepthCheckPrompt(currentDepth: number, maxDepth: number): string {
    return `You are at recursion depth ${currentDepth} of ${maxDepth}.

You need to make progress toward a final answer soon.

Consider:
- Can you provide a final answer now?
- What is the minimum additional information needed?
- How can you be most efficient with remaining depth?

Make a decision that balances thoroughness with efficiency.`;
  }
}
