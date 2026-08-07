import "server-only";

import { isNull, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Shared Query Filter Utilities
 *
 * Common filter predicates used across academics query files.
 * Reduces duplication and ensures consistent soft-delete handling.
 */

/**
 * Creates a soft-delete filter condition: `table.deletedAt IS NULL`
 *
 * @example
 * ```ts
 * .where(and(eq(sections.id, id), notDeleted(sections)))
 * ```
 */
export function notDeleted<T extends { deletedAt: PgColumn }>(
  table: T
): SQL<unknown> {
  return isNull(table.deletedAt);
}

/**
 * Creates an active record filter: `table.isActive = true`
 *
 * @example
 * ```ts
 * .where(and(isActiveFilter(subjectOfferings), notDeleted(subjectOfferings)))
 * ```
 */
export function isActiveFilter<T extends { isActive: PgColumn }>(
  table: T
): SQL<unknown> {
  return eq(table.isActive, true);
}
