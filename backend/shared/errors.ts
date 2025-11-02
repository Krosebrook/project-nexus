import { APIError } from "encore.dev/api";
import log from "encore.dev/log";

export interface ErrorContext {
  endpoint?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = "ApplicationError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "VALIDATION_ERROR", 400, context);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "NOT_FOUND", 404, context);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "CONFLICT", 409, context);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "UNAUTHORIZED", 401, context);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "FORBIDDEN", 403, context);
    this.name = "ForbiddenError";
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, context);
    this.name = "RateLimitError";
  }
}

export class InternalError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "INTERNAL_ERROR", 500, context);
    this.name = "InternalError";
  }
}

export function handleError(error: unknown, context?: ErrorContext): never {
  const errorContext: ErrorContext = {
    ...context,
    metadata: {
      ...context?.metadata,
      timestamp: new Date().toISOString(),
    },
  };

  log.error("Error occurred", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: errorContext,
  });

  if (error instanceof APIError) {
    throw error;
  }

  if (error instanceof ApplicationError) {
    throw toAPIError(error);
  }

  if (error instanceof Error) {
    if (error.message.includes("not found")) {
      throw APIError.notFound(error.message);
    }
    if (error.message.includes("already exists")) {
      throw APIError.alreadyExists(error.message);
    }
    if (error.message.includes("permission denied") || error.message.includes("unauthorized")) {
      throw APIError.permissionDenied(error.message);
    }
    if (error.message.includes("invalid") || error.message.includes("validation")) {
      throw APIError.invalidArgument(error.message);
    }
    
    throw APIError.internal(error.message);
  }

  throw APIError.internal("An unexpected error occurred");
}

export function toAPIError(error: ApplicationError): APIError {
  let apiError: APIError;

  switch (error.statusCode) {
    case 400:
      apiError = APIError.invalidArgument(error.message);
      break;
    case 401:
      apiError = APIError.unauthenticated(error.message);
      break;
    case 403:
      apiError = APIError.permissionDenied(error.message);
      break;
    case 404:
      apiError = APIError.notFound(error.message);
      break;
    case 409:
      apiError = APIError.alreadyExists(error.message);
      break;
    case 429:
      apiError = APIError.resourceExhausted(error.message);
      break;
    default:
      apiError = APIError.internal(error.message);
  }

  if (error.context) {
    return apiError.withDetails(error.context);
  }

  return apiError;
}

export function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Partial<ErrorContext>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context as ErrorContext);
    }
  }) as T;
}

export function assertExists<T>(
  value: T | null | undefined,
  message: string = "Value does not exist"
): T {
  if (value === null || value === undefined) {
    throw new NotFoundError(message);
  }
  return value;
}

export function assertValid(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new ValidationError(message);
  }
}

export function assertAuthorized(
  condition: boolean,
  message: string = "Access denied"
): asserts condition {
  if (!condition) {
    throw new ForbiddenError(message);
  }
}
