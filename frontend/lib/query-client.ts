import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { logErrorToBackend } from "./error-logger";

const queryCache = new QueryCache({
  onError: (error) => {
    console.error("Query error:", error);
    logErrorToBackend({
      error: error instanceof Error ? error : new Error(String(error)),
      severity: "error",
      metadata: { source: "react-query-cache" }
    });
  }
});

const mutationCache = new MutationCache({
  onError: (error) => {
    console.error("Mutation error:", error);
    logErrorToBackend({
      error: error instanceof Error ? error : new Error(String(error)),
      severity: "error",
      metadata: { source: "react-query-mutation" }
    });
  }
});

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 1,
      retryDelay: 1000
    }
  }
});