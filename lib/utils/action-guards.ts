import "server-only";
import { redirect } from "next/navigation";
import { requireSession, getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";

/**
 * Requires authentication and a specific permission.
 * Throws redirect if unauthenticated, returns user session if authorized.
 * Returns early error for server actions if unauthorized.
 *
 * @param permission - The required permission to check
 * @returns Session user object if authorized
 * @throws Redirects to /login if not authenticated
 *
 * @example
 * ```typescript
 * // BEFORE (30+ duplicate instances):
 * const session = await requireSession();
 * if (!hasPermission(session.role, "students:create")) {
 *   return { message: "You do not have permission..." };
 * }
 *
 * // AFTER:
 * const session = await requirePermission("students:create");
 * ```
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!hasPermission(user.role, permission)) {
    throw new Error(`Forbidden: Missing permission '${permission}'`);
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
