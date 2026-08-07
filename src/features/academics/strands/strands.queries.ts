import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { strands, subjects, sections, enrollments } from "@/lib/db/schema";
import { eq, and, isNull, sql, asc, ne } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type { TrackCategory } from "@/lib/constants/track-categories";
import type { StrandView, StrandOption, StrandsByCategory } from "./strands.schema";

/**
 * Get all active tracks for dropdown selection.
 * Cached for performance since strands rarely change.
 */
export async function getActiveStrands(): Promise<StrandOption[]> {
  "use cache";
  cacheTag(CACHE_TAGS.STRANDS);
  cacheLife("hours");

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
 *
 * Performance: Uses parallel batch queries instead of correlated subqueries
 * to reduce O(n×3) database calls to O(4) fixed queries.
 *
 * Cached for performance since strands and their counts rarely change rapidly.
 */
export async function getAllStrands(): Promise<StrandView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.STRANDS);
  cacheLife("hours");

  // Fetch strands and all counts in parallel
  const [strandRows, subjectCounts, sectionCounts, enrollmentCounts] = await Promise.all([
    // Base strand data
    db
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
      .where(isNull(strands.deletedAt))
      .orderBy(asc(strands.displayOrder)),

    // Subject counts grouped by strand
    db
      .select({
        strandId: subjects.strandId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(subjects)
      .where(and(isNull(subjects.deletedAt), sql`${subjects.strandId} IS NOT NULL`))
      .groupBy(subjects.strandId),

    // Section counts grouped by strand
    db
      .select({
        strandId: sections.strandId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(sections)
      .where(and(isNull(sections.deletedAt), sql`${sections.strandId} IS NOT NULL`))
      .groupBy(sections.strandId),

    // Enrollment counts grouped by strand (excluding cancelled)
    db
      .select({
        strandId: enrollments.strandId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(enrollments)
      .where(and(ne(enrollments.status, "cancelled"), sql`${enrollments.strandId} IS NOT NULL`))
      .groupBy(enrollments.strandId),
  ]);

  // Build lookup maps for O(1) access
  const subjectCountMap = new Map(subjectCounts.map((r) => [r.strandId, r.count]));
  const sectionCountMap = new Map(sectionCounts.map((r) => [r.strandId, r.count]));
  const enrollmentCountMap = new Map(enrollmentCounts.map((r) => [r.strandId, r.count]));

  return strandRows.map((row) => ({
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
    subjectCount: subjectCountMap.get(row.id) ?? 0,
    sectionCount: sectionCountMap.get(row.id) ?? 0,
    enrollmentCount: enrollmentCountMap.get(row.id) ?? 0,
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
 *
 * Performance: Single query with optional excludeId filter instead of
 * conditional double query.
 */
export async function strandCodeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const conditions = [eq(strands.code, code), isNull(strands.deletedAt)];

  // Include excludeId in the WHERE clause directly
  if (excludeId) {
    conditions.push(ne(strands.id, excludeId));
  }

  const [row] = await db
    .select({ exists: sql<boolean>`true` })
    .from(strands)
    .where(and(...conditions))
    .limit(1);

  return row !== undefined;
}

/**
 * Check if a short code already exists (for uniqueness validation).
 *
 * Performance: Single query with optional excludeId filter instead of
 * conditional double query.
 */
export async function shortCodeExists(
  shortCode: string,
  excludeId?: string
): Promise<boolean> {
  const conditions = [eq(strands.shortCode, shortCode), isNull(strands.deletedAt)];

  // Include excludeId in the WHERE clause directly
  if (excludeId) {
    conditions.push(ne(strands.id, excludeId));
  }

  const [row] = await db
    .select({ exists: sql<boolean>`true` })
    .from(strands)
    .where(and(...conditions))
    .limit(1);

  return row !== undefined;
}

