import { isServer, QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { STANDARD_STALE_TIME } from "./staleness";

/**
 * Global error handler for TanStack Query.
 * Logs errors in development and can be extended for error monitoring (e.g., Sentry).
 */
function handleQueryError(error: Error): void {
  // Log in development for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("[TanStack Query] Query error:", error);
  }
  // TODO: Add error monitoring integration (Sentry, LogRocket, etc.)
}

function handleMutationError(error: Error): void {
  // Log in development for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("[TanStack Query] Mutation error:", error);
  }
  // TODO: Add error monitoring integration (Sentry, LogRocket, etc.)
}

/**
 * Create a new QueryClient instance with default options.
 * This is called on every request on the server, and once on the client.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleQueryError,
    }),
    mutationCache: new MutationCache({
      onError: handleMutationError,
    }),
    defaultOptions: {
      queries: {
        // Data is fresh for 1 minute before refetching
        staleTime: STANDARD_STALE_TIME,
        // Garbage collection time - 5 minutes
        gcTime: 5 * 60 * 1000,
        // Only retry once on failure
        retry: 1,
        // Don't refetch on window focus by default (can override per-query)
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Browser singleton - maintains cache across navigations
let browserQueryClient: QueryClient | undefined;

/**
 * Get the QueryClient instance.
 * - On the server: Creates a new QueryClient for each request (no shared state)
 * - On the client: Returns a singleton (maintains cache across navigations)
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    // Server: always create a new QueryClient
    return makeQueryClient();
  }

  // Browser: use singleton pattern
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}
