/**
 * Abstract LLM Client Interface
 * Defines the contract for all LLM client implementations
 */

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  finishReason: string;
  model: string;
}

export interface LLMClient {
  /**
   * Call the LLM with a prompt and optional configuration
   * @param prompt - The prompt to send to the LLM
   * @param config - Optional configuration for the LLM call
   * @returns Promise resolving to the LLM response
   */
  call(prompt: string, config?: LLMConfig): Promise<LLMResponse>;

  /**
   * Count tokens in a text string
   * @param text - The text to count tokens for
   * @returns The number of tokens
   */
  countTokens(text: string): number;
}
