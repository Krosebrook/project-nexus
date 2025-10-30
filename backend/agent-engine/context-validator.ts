/**
 * Context Window Validator
 *
 * Provides token estimation and context window validation.
 * Uses the approximation: tokens ≈ characters / 4
 */

/**
 * Context validator configuration
 */
export const CONTEXT_CONFIG = {
  // Rough approximation: 1 token ≈ 4 characters
  CHARS_PER_TOKEN: 4,

  // Safety margin to account for estimation errors (10%)
  SAFETY_MARGIN: 0.9,
};

/**
 * Context window validation result
 */
export interface ContextValidationResult {
  valid: boolean;
  estimated: number;
  limit: number;
  message?: string;
}

/**
 * Context Window Validator
 * Estimates token usage and validates against context window limits
 */
export class ContextWindowValidator {
  /**
   * Estimate tokens from text using character-based approximation
   *
   * @param text - Input text to estimate
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Basic estimation: chars / 4 ≈ tokens
    const estimatedTokens = Math.ceil(text.length / CONTEXT_CONFIG.CHARS_PER_TOKEN);

    return estimatedTokens;
  }

  /**
   * Validate context window against a limit
   *
   * @param prompt - Input prompt text
   * @param limit - Maximum token limit
   * @returns Validation result with details
   */
  validateContextWindow(
    prompt: string,
    limit: number
  ): ContextValidationResult {
    // Estimate tokens
    const estimatedTokens = this.estimateTokens(prompt);

    // Apply safety margin to limit to account for estimation errors
    const effectiveLimit = Math.floor(limit * CONTEXT_CONFIG.SAFETY_MARGIN);

    // Validate
    const valid = estimatedTokens <= effectiveLimit;

    if (!valid) {
      return {
        valid: false,
        estimated: estimatedTokens,
        limit,
        message: `Context window exceeded: ${estimatedTokens} tokens (estimated) > ${limit} limit`,
      };
    }

    return {
      valid: true,
      estimated: estimatedTokens,
      limit,
    };
  }

  /**
   * Validate multiple text inputs combined
   *
   * @param texts - Array of text inputs to combine
   * @param limit - Maximum token limit
   * @returns Validation result
   */
  validateMultipleTexts(
    texts: string[],
    limit: number
  ): ContextValidationResult {
    // Combine all texts
    const combinedText = texts.join("\n\n");

    return this.validateContextWindow(combinedText, limit);
  }

  /**
   * Get remaining token budget
   *
   * @param currentText - Current text
   * @param limit - Maximum token limit
   * @returns Remaining tokens available
   */
  getRemainingTokens(currentText: string, limit: number): number {
    const estimatedTokens = this.estimateTokens(currentText);
    const remaining = limit - estimatedTokens;

    return Math.max(0, remaining);
  }

  /**
   * Check if adding new text would exceed limit
   *
   * @param currentText - Current text
   * @param newText - New text to add
   * @param limit - Maximum token limit
   * @returns Whether the addition is safe
   */
  canAddText(currentText: string, newText: string, limit: number): boolean {
    const currentTokens = this.estimateTokens(currentText);
    const newTokens = this.estimateTokens(newText);
    const totalTokens = currentTokens + newTokens;

    const effectiveLimit = Math.floor(limit * CONTEXT_CONFIG.SAFETY_MARGIN);

    return totalTokens <= effectiveLimit;
  }
}

/**
 * Singleton instance
 */
export const contextValidator = new ContextWindowValidator();
