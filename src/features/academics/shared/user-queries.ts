import "server-only";

import { db } from "@/lib/db";
import { users, roleEnum } from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";

/**
 * User role type derived from the roleEnum.
 */
type UserRole = (typeof roleEnum.enumValues)[number];

/**
 * Shared User Query Utilities
 *
 * Unified queries for fetching users by role, used across
 * adviser and coordinator assignment features.
 */

/**
 * User option for dropdowns/selection.
 */
export type UserOption = {
  id: string;
  name: string;
  email: string;
};

/**
 * Get all active users with a specific role for assignment dropdowns.
 *
 * Consolidates duplicate patterns from:
 * - advisers.queries.ts: getAvailableTeachers()
 * - coordinators.queries.ts: getAvailableCoordinators()
 *
 * @param role - The user role to filter by
 * @returns List of users with the specified role
 *
 * @example
 * ```ts
 * const teachers = await getAvailableUsersByRole("teacher");
 * const coordinators = await getAvailableUsersByRole("coordinator");
 * ```
 */
export async function getAvailableUsersByRole(
  role: UserRole
): Promise<UserOption[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.username,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.role, role),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    )
    .orderBy(asc(users.username));

  return rows;
}

/**
 * Get available teachers for adviser assignment.
 * Convenience wrapper around getAvailableUsersByRole.
 */
export async function getAvailableTeachers(): Promise<UserOption[]> {
  return getAvailableUsersByRole("teacher");
}

/**
 * Get available coordinators for coordinator assignment.
 * Convenience wrapper around getAvailableUsersByRole.
 */
export async function getAvailableCoordinators(): Promise<UserOption[]> {
  return getAvailableUsersByRole("coordinator");
}
