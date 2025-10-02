import { APIError } from "encore.dev/api";
import log from "encore.dev/log";

export interface ErrorContext {
  endpoint: string;
  timestamp: Date;
  userId?: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleError(error: unknown, context: ErrorContext): never {
  log.error("API error occurred", {
    error: error instanceof Error ? error.message : String(error),
    context,
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (error instanceof APIError) {
    throw error;
  }

  if (error instanceof AppError) {
    switch (error.statusCode) {
      case 404:
        throw error.context 
          ? APIError.notFound(error.message).withDetails(error.context)
          : APIError.notFound(error.message);
      case 409:
        throw error.context
          ? APIError.alreadyExists(error.message).withDetails(error.context)
          : APIError.alreadyExists(error.message);
      case 403:
        throw error.context
          ? APIError.permissionDenied(error.message).withDetails(error.context)
          : APIError.permissionDenied(error.message);
      case 429:
        throw error.context
          ? APIError.resourceExhausted(error.message).withDetails(error.context)
          : APIError.resourceExhausted(error.message);
      case 400:
        throw error.context
          ? APIError.invalidArgument(error.message).withDetails(error.context)
          : APIError.invalidArgument(error.message);
      default:
        throw error.context
          ? APIError.internal(error.message).withDetails(error.context)
          : APIError.internal(error.message);
    }
  }

  if (error instanceof Error) {
    if (error.message.includes("not found")) {
      throw APIError.notFound(error.message);
    }
    if (error.message.includes("already exists")) {
      throw APIError.alreadyExists(error.message);
    }
    if (error.message.includes("permission denied")) {
      throw APIError.permissionDenied(error.message);
    }
    throw APIError.internal(error.message);
  }

  throw APIError.internal("An unexpected error occurred");
}

export function validateRequired<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw APIError.invalidArgument(`${fieldName} is required`);
  }
  return value;
}

export function validatePositive(value: number, fieldName: string): number {
  if (value <= 0) {
    throw APIError.invalidArgument(`${fieldName} must be positive`);
  }
  return value;
}

export function validateNonEmpty(value: string, fieldName: string): string {
  if (!value || value.trim().length === 0) {
    throw APIError.invalidArgument(`${fieldName} cannot be empty`);
  }
  return value;
}
