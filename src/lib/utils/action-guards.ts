import "server-only";
import { redirect } from "next/navigation";
import { getStaffUser, type SessionUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";

/**
 * Requires authentication and a specific permission.
 * Redirects if unauthenticated or if session is a portal session (staff-only).
 * Returns a forbidden discriminated-union value for server actions when unauthorized.
 *
 * @param permission - The required permission to check
 * @returns Session user object if authorized, or `{ error: "forbidden", message }` if unauthorized
 * @throws Redirects to /login if not authenticated, or /portal/dashboard if portal session
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
  const user = await getStaffUser();

  if (!user) {
    redirect("/login");
  }

  if (!hasPermission(user.role, permission)) {
    return {
      error: "forbidden",
      message: PERMISSION_ERRORS.GENERIC,
    };
  }

  return user;
}

/**
 * Requires staff authentication without checking specific permissions.
 * Throws redirect if unauthenticated or if session is a portal session.
 *
 * @returns Session user object (staff only)
 * @throws Redirects to /login if not authenticated
 *
 * @example
 * ```typescript
 * const session = await requireAuth();
 * ```
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getStaffUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
