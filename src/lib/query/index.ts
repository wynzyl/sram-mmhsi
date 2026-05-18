/**
 * TanStack Query utilities and configuration.
 *
 * This module provides:
 * - Query client factory for SSR/browser singleton pattern
 * - Centralized query key factories for type-safe cache management
 */

export { getQueryClient } from "./query-client";
export { queryKeys, type QueryKeys } from "./keys";
