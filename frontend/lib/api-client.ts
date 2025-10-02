import { useToast } from "@/components/ui/use-toast";

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
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
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

export function useAPIErrorHandler() {
  const { toast } = useToast();

  const handleError = (error: unknown, customMessage?: string) => {
    console.error("API Error:", error);
    
    const message = customMessage || getErrorMessage(error);
    
    toast({
      variant: "destructive",
      title: "Error",
      description: message,
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

export function getRetryAfter(error: unknown): number | null {
  if (isAPIError(error) && error.details?.retryAfter) {
    const retryAfter = error.details.retryAfter as string;
    const seconds = parseInt(retryAfter.replace("s", ""), 10);
    return isNaN(seconds) ? null : seconds;
  }
  return null;
}
