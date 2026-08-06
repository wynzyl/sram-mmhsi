import "server-only";
import { db } from "@/lib/db";
import { strands, subjects, sections, enrollments } from "@/lib/db/schema";
import { eq, and, isNull, sql, count, asc } from "drizzle-orm";
import type { TrackCategory } from "@/lib/constants/track-categories";
import type { StrandView, StrandOption, StrandsByCategory } from "./strands.schema";

/**
 * Get all active tracks for dropdown selection.
 */
export async function getActiveStrands(): Promise<StrandOption[]> {
  const rows = await db
    .select({
      id: strands.id,
      code: strands.code,
      shortCode: strands.shortCode,
      name: strands.name,
      trackCategory: strands.trackCategory,
      isActive: strands.isActive,
    })
    .from(strands)
    .where(and(eq(strands.isActive, true), isNull(strands.deletedAt)))
    .orderBy(asc(strands.displayOrder));

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    shortCode: row.shortCode,
    trackCategory: row.trackCategory as TrackCategory,
    isActive: row.isActive,
  }));
}

/**
 * Get active tracks for SHS enrollment/assignment.
 * Returns tracks grouped by category for UI organization.
 */
export async function getActiveTracksForSHS(): Promise<StrandsByCategory> {
  const activeStrands = await getActiveStrands();

  return {
    academic: activeStrands.filter((s) => s.trackCategory === "academic"),
    tvl: activeStrands.filter((s) => s.trackCategory === "tvl"),
    specialized: activeStrands.filter((s) => s.trackCategory === "specialized"),
  };
}

/**
 * Get all tracks (including inactive) for admin management.
 * Includes counts of associated subjects, sections, and enrollments.
 */
export async function getAllStrands(): Promise<StrandView[]> {
  const rows = await db
    .select({
      id: strands.id,
      code: strands.code,
      shortCode: strands.shortCode,
      name: strands.name,
      description: strands.description,
      trackCategory: strands.trackCategory,
      displayOrder: strands.displayOrder,
      isActive: strands.isActive,
      createdAt: strands.createdAt,
      updatedAt: strands.updatedAt,
      // Count subjects with direct strand ownership (new model)
      subjectCount: sql<number>`
        (SELECT COUNT(*)::int FROM ${subjects}
         WHERE ${subjects.strandId} = ${strands.id}
         AND ${subjects.deletedAt} IS NULL)
      `,
      // Count sections assigned to this track
      sectionCount: sql<number>`
        (SELECT COUNT(*)::int FROM ${sections}
         WHERE ${sections.strandId} = ${strands.id}
         AND ${sections.deletedAt} IS NULL)
      `,
      // Count enrollments with this track
      enrollmentCount: sql<number>`
        (SELECT COUNT(*)::int FROM ${enrollments}
         WHERE ${enrollments.strandId} = ${strands.id}
         AND ${enrollments.status} != 'cancelled')
      `,
    })
    .from(strands)
    .where(isNull(strands.deletedAt))
    .orderBy(asc(strands.displayOrder));

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    shortCode: row.shortCode,
    name: row.name,
    description: row.description,
    trackCategory: row.trackCategory as TrackCategory,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    subjectCount: row.subjectCount,
    sectionCount: row.sectionCount,
    enrollmentCount: row.enrollmentCount,
  }));
}

/**
 * Get a single track by ID.
 */
export async function getStrandById(id: string): Promise<StrandView | null> {
  const [row] = await db
    .select({
      id: strands.id,
      code: strands.code,
      shortCode: strands.shortCode,
      name: strands.name,
      description: strands.description,
      trackCategory: strands.trackCategory,
      displayOrder: strands.displayOrder,
      isActive: strands.isActive,
      createdAt: strands.createdAt,
      updatedAt: strands.updatedAt,
    })
    .from(strands)
    .where(and(eq(strands.id, id), isNull(strands.deletedAt)))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    shortCode: row.shortCode,
    name: row.name,
    description: row.description,
    trackCategory: row.trackCategory as TrackCategory,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Check if a track code already exists (for uniqueness validation).
 */
export async function strandCodeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const conditions = [eq(strands.code, code), isNull(strands.deletedAt)];

  const [row] = await db
    .select({ count: count() })
    .from(strands)
    .where(and(...conditions));

  // If excluding an ID, check if the found strand is different
  if (excludeId && row.count > 0) {
    const [existing] = await db
      .select({ id: strands.id })
      .from(strands)
      .where(and(eq(strands.code, code), isNull(strands.deletedAt)))
      .limit(1);
    return existing?.id !== excludeId;
  }

  return row.count > 0;
}

/**
 * Check if a short code already exists (for uniqueness validation).
 */
export async function shortCodeExists(
  shortCode: string,
  excludeId?: string
): Promise<boolean> {
  const conditions = [eq(strands.shortCode, shortCode), isNull(strands.deletedAt)];

  const [row] = await db
    .select({ count: count() })
    .from(strands)
    .where(and(...conditions));

  if (excludeId && row.count > 0) {
    const [existing] = await db
      .select({ id: strands.id })
      .from(strands)
      .where(and(eq(strands.shortCode, shortCode), isNull(strands.deletedAt)))
      .limit(1);
    return existing?.id !== excludeId;
  }

  return row.count > 0;
}

/**
 * Get track options for enrollment form (SHS grade levels only).
 * Returns tracks grouped by category for UI.
 * @deprecated Use getActiveTracksForSHS instead
 */
export async function getStrandOptionsForEnrollment(): Promise<{
  academic: StrandOption[];
  tvl: StrandOption[];
}> {
  const grouped = await getActiveTracksForSHS();
  return {
    academic: grouped.academic,
    tvl: grouped.tvl,
  };
}
