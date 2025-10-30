/**
 * Mock LLM Client for Testing
 * Provides deterministic responses for testing purposes
 */

import { LLMClient, LLMConfig, LLMResponse } from "./llm-client";

export class MockLLMClient implements LLMClient {
  private responses: Map<string, string> = new Map();
  private delayMs: number = 0;
  private errorToThrow: Error | null = null;
  private defaultResponse: string = "Mock LLM response";

  constructor(responses?: Map<string, string>) {
    if (responses) {
      this.responses = responses;
    }
  }

  /**
   * Set a response for a specific prompt pattern
   * @param promptKey - The prompt pattern to match (exact match or substring)
   * @param response - The response to return
   */
  setResponse(promptKey: string, response: string): void {
    this.responses.set(promptKey, response);
  }

  /**
   * Set a delay to simulate network latency
   * @param ms - Delay in milliseconds
   */
  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  /**
   * Set an error to throw on the next call
   * @param error - The error to throw
   */
  setError(error: Error): void {
    this.errorToThrow = error;
  }

  /**
   * Reset the mock client to default state
   */
  reset(): void {
    this.responses.clear();
    this.delayMs = 0;
    this.errorToThrow = null;
  }

  /**
   * Call the mock LLM
   * Returns predefined responses based on prompt patterns
   */
  async call(prompt: string, config?: LLMConfig): Promise<LLMResponse> {
    // Simulate delay if configured
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    // Throw error if configured
    if (this.errorToThrow) {
      const error = this.errorToThrow;
      this.errorToThrow = null; // Reset after throwing
      throw error;
    }

    // Find matching response
    let responseContent = this.defaultResponse;

    // Check for exact match first
    if (this.responses.has(prompt)) {
      responseContent = this.responses.get(prompt)!;
    } else {
      // Check for substring match
      for (const [key, value] of this.responses.entries()) {
        if (prompt.includes(key)) {
          responseContent = value;
          break;
        }
      }
    }

    const tokensUsed = this.countTokens(prompt) + this.countTokens(responseContent);

    return {
      content: responseContent,
      tokensUsed,
      finishReason: "stop",
      model: config?.model || "mock-model",
    };
  }

  /**
   * Count tokens using simple approximation: chars / 4
   * @param text - The text to count tokens for
   * @returns The number of tokens (rounded up)
   */
  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
