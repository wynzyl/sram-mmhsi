import "server-only";
import { db } from "@/lib/db";
import { strands, subjectStrands, enrollments, students } from "@/lib/db/schema";
import { eq, and, isNull, sql, count, asc } from "drizzle-orm";
import {
  SHS_STRAND_SHORT_LABELS,
  type ShsStrandCode,
} from "@/lib/constants/strands";
import type { StrandView, StrandOption } from "./strands.schema";

/**
 * Get all active strands for dropdown selection.
 * Note: Cannot use "use cache" here because this file is re-exported through
 * index.ts which is imported by client components.
 */
export async function getActiveStrands(): Promise<StrandOption[]> {
  const rows = await db
    .select({
      id: strands.id,
      code: strands.code,
      name: strands.name,
      isActive: strands.isActive,
    })
    .from(strands)
    .where(and(eq(strands.isActive, true), isNull(strands.deletedAt)))
    .orderBy(asc(strands.displayOrder));

  return rows.map((row) => ({
    id: row.id,
    code: row.code as ShsStrandCode,
    name: row.name,
    shortName: SHS_STRAND_SHORT_LABELS[row.code as ShsStrandCode] ?? row.code,
    isActive: row.isActive,
  }));
}

/**
 * Get all strands (including inactive) for admin management.
 * Includes counts of associated subjects and enrollments.
 * Note: Cannot use "use cache" here because this file is re-exported through
 * index.ts which is imported by client components.
 */
export async function getAllStrands(): Promise<StrandView[]> {
  // Get strands with subject counts
  const rows = await db
    .select({
      id: strands.id,
      code: strands.code,
      name: strands.name,
      description: strands.description,
      displayOrder: strands.displayOrder,
      isActive: strands.isActive,
      createdAt: strands.createdAt,
      updatedAt: strands.updatedAt,
      subjectCount: sql<number>`
        (SELECT COUNT(*)::int FROM ${subjectStrands}
         WHERE ${subjectStrands.strandId} = ${strands.id}
         AND ${subjectStrands.deletedAt} IS NULL)
      `,
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
    code: row.code as ShsStrandCode,
    name: row.name,
    description: row.description,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    subjectCount: row.subjectCount,
    enrollmentCount: row.enrollmentCount,
  }));
}

/**
 * Get a single strand by ID.
 */
export async function getStrandById(id: string): Promise<StrandView | null> {
  const [row] = await db
    .select({
      id: strands.id,
      code: strands.code,
      name: strands.name,
      description: strands.description,
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
    code: row.code as ShsStrandCode,
    name: row.name,
    description: row.description,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Check if a strand code already exists (for uniqueness validation).
 */
export async function strandCodeExists(
  code: ShsStrandCode,
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
 * Get strand options for enrollment form (SHS grade levels only).
 * Returns strands grouped by track for UI.
 */
export async function getStrandOptionsForEnrollment(): Promise<{
  academic: StrandOption[];
  tvl: StrandOption[];
}> {
  const activeStrands = await getActiveStrands();

  const academic = activeStrands.filter(
    (s) => !s.code.startsWith("TVL-")
  );
  const tvl = activeStrands.filter((s) => s.code.startsWith("TVL-"));

  return { academic, tvl };
}
