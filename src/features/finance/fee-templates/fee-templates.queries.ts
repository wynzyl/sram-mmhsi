/**
 * Fee Templates Query Functions
 *
 * Server-only queries for reading fee templates, assignments, and overrides.
 */

import "server-only";
import { db } from "@/lib/db";
import {
  feeTemplates,
  feeTemplateItems,
  schoolYearFeeSchedules,
  feeScheduleOverrides,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Template Queries ─────────────────────────────────────────────────────

export async function getAllFeeTemplates() {
  return await db.query.feeTemplates.findMany({
    with: {
      items: {
        with: {
          feeItemType: true,
        },
        orderBy: (items, { asc }) => [asc(items.order)],
      },
    },
    orderBy: (t, { asc }) => [asc(t.assessmentBand), asc(t.name)],
  });
}

export async function getFeeTemplateById(id: string) {
  return await db.query.feeTemplates.findFirst({
    where: eq(feeTemplates.id, id),
    with: {
      items: {
        with: {
          feeItemType: true,
        },
        orderBy: (items, { asc }) => [asc(items.order)],
      },
    },
  });
}

export async function getActiveFeeTemplatesByBand(assessmentBand: string) {
  return await db.query.feeTemplates.findMany({
    where: and(
      eq(feeTemplates.assessmentBand, assessmentBand as any),
      eq(feeTemplates.isActive, true)
    ),
    with: {
      items: {
        with: {
          feeItemType: true,
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
            with: {
              feeItemType: true,
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
            with: {
              feeItemType: true,
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

export async function getAllFeeItemTypes() {
  return await db.query.feeItemTypes.findMany({
    where: eq(feeItemTypes.isActive, true),
    orderBy: (t, { asc }) => [asc(t.displayOrder), asc(t.name)],
  });
}

export async function getFeeItemTypesByCategory(category: string) {
  return await db.query.feeItemTypes.findMany({
    where: and(
      eq(feeItemTypes.category, category as any),
      eq(feeItemTypes.isActive, true)
    ),
    orderBy: (t, { asc }) => [asc(t.displayOrder), asc(t.name)],
  });
}
