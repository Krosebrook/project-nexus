/**
 * Resilient LLM Client with Exponential Backoff
 * Wraps any LLM client with automatic retry logic for transient errors
 */

import { LLMClient, LLMConfig, LLMResponse } from "./llm-client";
import {
  ErrorClassifier,
  TransientError,
  TerminalError,
} from "./error-classifier";

export class ResilientLLMClient implements LLMClient {
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  constructor(
    private client: LLMClient,
    private classifier: ErrorClassifier
  ) {}

  /**
   * Call the LLM with automatic retry logic for transient errors
   * Implements exponential backoff: 1s, 2s, 4s delays
   * @param prompt - The prompt to send to the LLM
   * @param config - Optional configuration for the LLM call
   * @returns Promise resolving to the LLM response
   */
  async call(prompt: string, config?: LLMConfig): Promise<LLMResponse> {
    let lastError: Error | null = null;

    // Attempt the call up to maxRetries + 1 times (initial + 3 retries)
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // First attempt is immediate, no delay
        if (attempt > 0) {
          // Calculate exponential backoff delay
          // Attempt 1 (retry 0): baseDelay * 2^0 = 1s
          // Attempt 2 (retry 1): baseDelay * 2^1 = 2s
          // Attempt 3 (retry 2): baseDelay * 2^2 = 4s
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }

        // Attempt the call
        const response = await this.client.call(prompt, config);
        return response;
      } catch (error) {
        // Classify the error
        const classifiedError = this.classifier.classify(error);

        // If it's a terminal error, throw immediately without retry
        if (classifiedError instanceof TerminalError) {
          throw classifiedError;
        }

        // If it's a transient error, store it and potentially retry
        if (classifiedError instanceof TransientError) {
          lastError = classifiedError;

          // If we've exhausted retries, throw the error
          if (attempt === this.maxRetries) {
            throw classifiedError;
          }

          // If the error specifies a retry-after time, use it
          if (classifiedError.retryAfter && attempt < this.maxRetries) {
            await this.sleep(classifiedError.retryAfter);
          }

          // Continue to next retry attempt
          continue;
        }

        // Unknown error type, treat as terminal
        throw classifiedError;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error("Unexpected retry loop exit");
  }

  /**
   * Count tokens in a text string
   * Delegates to the underlying client
   */
  countTokens(text: string): number {
    return this.client.countTokens(text);
  }

  /**
   * Sleep for a specified duration
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set the maximum number of retries (for testing)
   */
  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  /**
   * Set the base delay for exponential backoff (for testing)
   */
  setBaseDelay(baseDelay: number): void {
    this.baseDelay = baseDelay;
  }
}
