import backend from "~backend/client";

export interface LogErrorOptions {
  error: Error;
  errorInfo?: any;
  severity?: "info" | "warning" | "error" | "critical";
  metadata?: Record<string, any>;
}

export async function logErrorToBackend(options: LogErrorOptions): Promise<void> {
  try {
    await backend.errors.logError({
      error_type: options.error.name || "UnknownError",
      error_message: options.error.message,
      error_stack: options.error.stack,
      component_stack: options.errorInfo?.componentStack,
      url: window.location.href,
      user_agent: navigator.userAgent,
      severity: options.severity || "error",
      metadata: {
        ...options.metadata,
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    });
  } catch (logError) {
    console.error("Failed to log error to backend:", logError);
  }
}

export function setupGlobalErrorHandler(): void {
  window.addEventListener("error", (event) => {
    logErrorToBackend({
      error: event.error || new Error(event.message),
      severity: "error",
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logErrorToBackend({
      error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      severity: "error",
      metadata: {
        type: "unhandledRejection"
      }
    });
  });
}