import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";

/**
 * Requires authentication and a specific permission.
 * Redirects if unauthenticated, returns user session if authorized.
 * Returns a forbidden discriminated-union value for server actions when unauthorized.
 *
 * @param permission - The required permission to check
 * @returns Session user object if authorized, or `{ error: "forbidden", message }` if unauthorized
 * @throws Redirects to /login if not authenticated
 *
 * @example
 * ```typescript
 * const auth = await requirePermission("students:create");
 * if ("error" in auth) {
 *   return { message: auth.message };
 * }
 *
 * const session = auth;
 * ```
 */
export type ForbiddenResult = {
  error: "forbidden";
  message: string;
};

export async function requirePermission(
  permission: Permission
): Promise<SessionUser | ForbiddenResult> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!hasPermission(user.role, permission)) {
    return {
      error: "forbidden",
      message: "You do not have permission to perform this action.",
    };
  }

  return user;
}

/**
 * Requires authentication without checking specific permissions.
 * Throws redirect if unauthenticated.
 *
 * @returns Session user object
 * @throws Redirects to /login if not authenticated
 *
 * @example
 * ```typescript
 * const session = await requireAuth();
 * ```
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
