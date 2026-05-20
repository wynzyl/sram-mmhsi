import { isServer, QueryClient } from "@tanstack/react-query";

/**
 * Create a new QueryClient instance with default options.
 * This is called on every request on the server, and once on the client.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is fresh for 1 minute before refetching
        staleTime: 60 * 1000,
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
