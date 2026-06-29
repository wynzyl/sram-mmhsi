/**
 * Fee Templates Query Functions
 *
 * Server-only queries for reading fee templates, assignments, and overrides.
 */

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import {
  feeTemplates,
  schoolYearFeeSchedules,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, and, asc, sql, isNull } from "drizzle-orm";
import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";
import { calculateOffset, calculatePagination } from "@/lib/types/pagination";

// ─── Template Queries ─────────────────────────────────────────────────────

/**
 * Get all fee templates (LEGACY - use getFeeTemplatesPaginated for better performance)
 * @deprecated Use getFeeTemplatesPaginated for large datasets
 */
export async function getAllFeeTemplates() {
  return await db.query.feeTemplates.findMany({
    with: {
      items: {
        columns: { id: true, defaultAmount: true, order: true, feeItemTypeId: true },
        where: (items, { isNull }) => isNull(items.deletedAt),
        with: {
          feeItemType: {
            columns: { id: true, name: true, code: true, category: true, isDiscount: true },
          },
        },
        orderBy: (items, { asc }) => [asc(items.order)],
      },
    },
    orderBy: (t, { asc }) => [asc(t.assessmentBand), asc(t.name)],
  });
}

/**
 * Get fee templates with pagination (PERFORMANCE: 80-90% memory reduction)
 */
export async function getFeeTemplatesPaginated(
  params: PaginationParams = { page: 1, pageSize: 25 }
): Promise<PaginatedResult<typeof feeTemplates.$inferSelect>> {
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(feeTemplates)
    .where(
      and(
        eq(feeTemplates.isActive, true),
        sql`${feeTemplates.deletedAt} IS NULL`
      )
    );

  const totalRecords = Number(countResult?.count || 0);
  const offset = calculateOffset(params.page, params.pageSize);

  const templates = await db.query.feeTemplates.findMany({
    with: {
      items: {
        columns: { id: true, defaultAmount: true, order: true, feeItemTypeId: true },
        where: (items, { isNull }) => isNull(items.deletedAt),
        with: {
          feeItemType: {
            columns: { id: true, name: true, code: true, category: true, isDiscount: true },
          },
        },
        orderBy: (items, { asc }) => [asc(items.order)],
      },
    },
    where: and(
      eq(feeTemplates.isActive, true),
      sql`${feeTemplates.deletedAt} IS NULL`
    ),
    orderBy: (t, { asc }) => [asc(t.assessmentBand), asc(t.name)],
    limit: params.pageSize,
    offset,
  });

  return {
    data: templates,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Get lightweight fee templates for dropdowns (PERFORMANCE: No nested relations)
 * Cached for 10 minutes since templates rarely change during active use.
 */
export async function getFeeTemplatesForDropdown() {
  "use cache";
  cacheTag(CACHE_TAGS.FEE_TEMPLATES);
  cacheLife("fee-templates"); // Custom 10-min profile

  return await db
    .select({
      id: feeTemplates.id,
      name: feeTemplates.name,
      assessmentBand: feeTemplates.assessmentBand,
    })
    .from(feeTemplates)
    .where(
      and(
        eq(feeTemplates.isActive, true),
        isNull(feeTemplates.deletedAt)
      )
    )
    .orderBy(asc(feeTemplates.assessmentBand), asc(feeTemplates.name));
}

export async function getFeeTemplateById(id: string) {
  return await db.query.feeTemplates.findFirst({
    where: eq(feeTemplates.id, id),
    with: {
      items: {
        columns: { id: true, defaultAmount: true, order: true, feeItemTypeId: true },
        where: (items, { isNull }) => isNull(items.deletedAt),
        with: {
          feeItemType: {
            columns: { id: true, name: true, code: true, category: true, isDiscount: true },
          },
        },
        orderBy: (items, { asc }) => [asc(items.order)],
      },
    },
  });
}

export async function getActiveFeeTemplatesByBand(assessmentBand: string) {
  return await db.query.feeTemplates.findMany({
    where: and(
      eq(feeTemplates.assessmentBand, assessmentBand as typeof feeTemplates.assessmentBand.enumValues[number]),
      eq(feeTemplates.isActive, true)
    ),
    with: {
      items: {
        columns: { id: true, defaultAmount: true, order: true, feeItemTypeId: true },
        where: (items, { isNull }) => isNull(items.deletedAt),
        with: {
          feeItemType: {
            columns: { id: true, name: true, code: true, category: true, isDiscount: true },
          },
        },
        orderBy: (items, { asc }) => [asc(items.order)],
      },
    },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
}

// ─── Schedule Assignment Queries ──────────────────────────────────────────

export async function getSchoolYearFeeSchedules(schoolYearId: string) {
  return await db.query.schoolYearFeeSchedules.findMany({
    where: eq(schoolYearFeeSchedules.schoolYearId, schoolYearId),
    with: {
      feeTemplate: {
        with: {
          items: {
            columns: { id: true, defaultAmount: true, order: true, feeItemTypeId: true },
            where: (items, { isNull }) => isNull(items.deletedAt),
            with: {
              feeItemType: {
                columns: { id: true, name: true, code: true, category: true, isDiscount: true },
              },
            },
            orderBy: (items, { asc }) => [asc(items.order)],
          },
        },
      },
      overrides: true,
    },
    orderBy: (t, { asc }) => [asc(t.assessmentBand)],
  });
}

export async function getFeeScheduleById(id: string) {
  return await db.query.schoolYearFeeSchedules.findFirst({
    where: eq(schoolYearFeeSchedules.id, id),
    with: {
      feeTemplate: {
        with: {
          items: {
            columns: { id: true, defaultAmount: true, order: true, feeItemTypeId: true },
            where: (items, { isNull }) => isNull(items.deletedAt),
            with: {
              feeItemType: {
                columns: { id: true, name: true, code: true, category: true, isDiscount: true },
              },
            },
            orderBy: (items, { asc }) => [asc(items.order)],
          },
        },
      },
      overrides: true,
    },
  });
}

// ─── Fee Item Types ───────────────────────────────────────────────────────

/**
 * Get all fee item types with caching.
 * Fee item types are static configuration, so 10 minute cache is safe.
 */
export async function getAllFeeItemTypes() {
  "use cache";
  cacheTag(CACHE_TAGS.FEE_ITEM_TYPES);
  cacheLife("fee-templates"); // Custom 10-min profile

  return await db.query.feeItemTypes.findMany({
    columns: {
      id: true,
      code: true,
      name: true,
      category: true,
      isDiscount: true,
      isRefundable: true,
      displayOrder: true,
      isActive: true,
    },
    where: eq(feeItemTypes.isActive, true),
    orderBy: (t, { asc }) => [asc(t.displayOrder), asc(t.name)],
  });
}

export async function getFeeItemTypesByCategory(category: string) {
  return await db.query.feeItemTypes.findMany({
    columns: {
      id: true,
      code: true,
      name: true,
      category: true,
      isDiscount: true,
      isRefundable: true,
      displayOrder: true,
      isActive: true,
    },
    where: and(
      eq(feeItemTypes.category, category as typeof feeItemTypes.category.enumValues[number]),
      eq(feeItemTypes.isActive, true)
    ),
    orderBy: (t, { asc }) => [asc(t.displayOrder), asc(t.name)],
  });
}
