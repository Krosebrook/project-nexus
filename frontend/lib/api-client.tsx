import { useToast } from "@/components/ui/use-toast";

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status?: number;
}

export function isAPIError(error: unknown): error is APIError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

export function getErrorMessage(error: unknown): string {
  if (isAPIError(error)) {
    if (error.status === 401) {
      return "Please log in to continue";
    }
    if (error.status === 403) {
      return "You don't have permission to perform this action";
    }
    if (error.status === 404) {
      return "The requested resource was not found";
    }
    if (error.status === 429) {
      return "Too many requests. Please try again later";
    }
    if (error.status === 500) {
      return "Server error. Please contact support if this persists";
    }
    if (error.status === 503) {
      return "Service temporarily unavailable. Please try again later";
    }
    return error.message;
  }
  if (error instanceof Error) {
    if (error.name === "NetworkError" || error.message.includes("network")) {
      return "Connection lost. Please check your internet connection";
    }
    if (error.name === "TimeoutError" || error.message.includes("timeout")) {
      return "Request timed out. Please try again";
    }
    return error.message;
  }
  return "An unexpected error occurred";
}

export function useAPIErrorHandler() {
  const { toast } = useToast();

  const handleError = (error: unknown, customMessage?: string, options?: {
    retry?: () => void;
  }) => {
    console.error("API Error:", error);
    
    const message = customMessage || getErrorMessage(error);
    
    if (isAPIError(error) && error.status === 401) {
      window.location.href = "/login";
      return;
    }
    
    toast({
      variant: "destructive",
      title: "Error",
      description: message,
      action: options?.retry ? (
        <button
          onClick={options.retry}
          className="px-3 py-1.5 text-sm bg-background/80 hover:bg-background rounded-md"
        >
          Retry
        </button>
      ) : undefined,
    });
  };

  return { handleError };
}

export async function withErrorHandling<T>(
  apiCall: () => Promise<T>,
  errorMessage?: string
): Promise<T | null> {
  try {
    return await apiCall();
  } catch (error) {
    console.error(errorMessage || "API call failed:", error);
    throw error;
  }
}

export async function withRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      if (isAPIError(error) && error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError;
}

export function getRetryAfter(error: unknown): number | null {
  if (isAPIError(error) && error.details?.retryAfter) {
    const retryAfter = error.details.retryAfter as string;
    const seconds = parseInt(retryAfter.replace("s", ""), 10);
    return isNaN(seconds) ? null : seconds;
  }
  return null;
}

export class TimeoutError extends Error {
  constructor(message: string = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError()), timeoutMs)
    ),
  ]);
}
