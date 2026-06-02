/**
 * API Route helper utilities.
 *
 * These utilities reduce boilerplate in API route handlers by providing
 * standardized patterns for authentication, parameter parsing, and responses.
 */

import { NextRequest, NextResponse, connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Handler function that receives the authenticated user.
 */
export type AuthenticatedHandler<T> = (
  request: NextRequest,
  user: SessionUser
) => Promise<T>;

/**
 * Options for the withAuth wrapper.
 */
interface WithAuthOptions {
  /** Required permission to access the route. If not specified, only authentication is checked. */
  permission?: Permission;
  /** Whether to call connection() for dynamic rendering. Defaults to true. */
  requireConnection?: boolean;
}

// ─── UUID Validation ───────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate and return a UUID string, or undefined if invalid.
 */
export function validateUuid(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return UUID_REGEX.test(value) ? value : undefined;
}

/**
 * Parse a numeric parameter with a default value.
 */
export function parseIntParam(
  value: string | null,
  defaultValue: number,
  options: { min?: number; max?: number } = {}
): number {
  const parsed = parseInt(value ?? String(defaultValue), 10);
  const result = Number.isNaN(parsed) ? defaultValue : parsed;

  let bounded = result;
  if (options.min !== undefined) bounded = Math.max(options.min, bounded);
  if (options.max !== undefined) bounded = Math.min(options.max, bounded);

  return bounded;
}

// ─── Response Helpers ──────────────────────────────────────────────────────────

/**
 * Create a successful JSON response.
 */
export function jsonResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Create an error response.
 */
export function errorResponse(
  message: string,
  status: 400 | 401 | 403 | 404 | 500
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard error responses.
 */
export const responses = {
  unauthorized: () => errorResponse("Unauthorized", 401),
  forbidden: () => errorResponse("Forbidden", 403),
  notFound: (resource = "Resource") => errorResponse(`${resource} not found`, 404),
  badRequest: (message: string) => errorResponse(message, 400),
  serverError: () => errorResponse("Internal server error", 500),
} as const;

// ─── Auth Wrapper ──────────────────────────────────────────────────────────────

/**
 * Wrap an API route handler with authentication and permission checks.
 *
 * This higher-order function reduces boilerplate by handling:
 * - Dynamic rendering (connection())
 * - User authentication
 * - Permission validation
 * - Error handling and logging
 *
 * @example
 * ```ts
 * export const GET = withAuth(
 *   { permission: "students:read" },
 *   async (request, user) => {
 *     const data = await fetchStudents();
 *     return jsonResponse({ data, canCreate: hasPermission(user.role, "students:create") });
 *   }
 * );
 * ```
 */
export function withAuth<T>(
  options: WithAuthOptions,
  handler: AuthenticatedHandler<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Ensure dynamic rendering for authenticated routes
    if (options.requireConnection !== false) {
      await connection();
    }

    try {
      const user = await getCurrentUser();

      if (!user) {
        return responses.unauthorized();
      }

      if (options.permission && !hasPermission(user.role, options.permission)) {
        return responses.forbidden();
      }

      return await handler(request, user);
    } catch (error) {
      logger.error("[api] Route handler error", {
        path: request.nextUrl.pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return responses.serverError();
    }
  };
}

/**
 * Simplified version for routes that only need authentication (no specific permission).
 */
export function withAuthOnly<T>(
  handler: AuthenticatedHandler<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse> {
  return withAuth({}, handler);
}
