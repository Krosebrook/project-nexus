/**
 * Error Classification for Retry Logic
 * Distinguishes between transient errors (retry) and terminal errors (fail fast)
 */

export class TransientError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "TransientError";
    Object.setPrototypeOf(this, TransientError.prototype);
  }
}

export class TerminalError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "TerminalError";
    Object.setPrototypeOf(this, TerminalError.prototype);
  }
}

export class ErrorClassifier {
  /**
   * Classify an error as transient (should retry) or terminal (fail immediately)
   * @param error - The error to classify
   * @returns TransientError or TerminalError
   */
  classify(error: any): TransientError | TerminalError {
    // Extract error details
    const message = error.message || "Unknown error";
    const statusCode = error.status || error.statusCode || error.code;
    const errorCode = error.code || error.error?.code || String(statusCode);

    // Check for rate limit errors (429)
    if (statusCode === 429 || errorCode === "429" || errorCode === "rate_limit_exceeded") {
      const retryAfter = error.retryAfter || error.retry_after || error.headers?.["retry-after"];
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      return new TransientError(
        `Rate limit exceeded: ${message}`,
        "RATE_LIMIT",
        retryAfterMs
      );
    }

    // Check for network errors
    const networkErrorCodes = [
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ENETUNREACH",
      "EHOSTUNREACH",
    ];
    if (networkErrorCodes.includes(errorCode)) {
      return new TransientError(
        `Network error: ${message}`,
        "NETWORK_ERROR"
      );
    }

    // Check for timeout errors
    if (
      errorCode === "ETIMEDOUT" ||
      errorCode === "timeout" ||
      message.toLowerCase().includes("timeout") ||
      message.toLowerCase().includes("timed out")
    ) {
      return new TransientError(`Timeout error: ${message}`, "TIMEOUT");
    }

    // Check for server errors (500, 502, 503, 504)
    const serverErrorCodes = [500, 502, 503, 504];
    if (
      serverErrorCodes.includes(statusCode) ||
      serverErrorCodes.includes(parseInt(errorCode, 10))
    ) {
      return new TransientError(
        `Server error ${statusCode}: ${message}`,
        "SERVER_ERROR"
      );
    }

    // Check for invalid API key (401)
    if (
      statusCode === 401 ||
      errorCode === "401" ||
      errorCode === "invalid_api_key" ||
      errorCode === "unauthorized"
    ) {
      return new TerminalError(
        `Invalid API key: ${message}`,
        "INVALID_API_KEY"
      );
    }

    // Check for invalid request (400)
    if (
      statusCode === 400 ||
      errorCode === "400" ||
      errorCode === "invalid_request_error" ||
      errorCode === "invalid_request"
    ) {
      return new TerminalError(
        `Invalid request: ${message}`,
        "INVALID_REQUEST"
      );
    }

    // Check for not found (404)
    if (statusCode === 404 || errorCode === "404" || errorCode === "not_found") {
      return new TerminalError(`Not found: ${message}`, "NOT_FOUND");
    }

    // Check for content policy violation
    if (
      errorCode === "content_policy_violation" ||
      errorCode === "content_filter" ||
      message.toLowerCase().includes("content policy") ||
      message.toLowerCase().includes("content filter")
    ) {
      return new TerminalError(
        `Content policy violation: ${message}`,
        "CONTENT_POLICY_VIOLATION"
      );
    }

    // Check for invalid model (404 or 400 with model in message)
    if (
      (statusCode === 404 || statusCode === 400) &&
      message.toLowerCase().includes("model")
    ) {
      return new TerminalError(
        `Invalid model: ${message}`,
        "INVALID_MODEL"
      );
    }

    // Default to terminal error for unknown errors
    return new TerminalError(
      `Unknown error: ${message}`,
      errorCode || "UNKNOWN"
    );
  }
}
