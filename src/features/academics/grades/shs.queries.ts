import "server-only";

/**
 * SHS Grade Entry Queries
 *
 * Queries for Senior High School strand-based grade entry:
 * - Subject offerings with strand info
 * - Students with strand assignments
 * - SSE-based subject queries
 */

import { db } from "@/lib/db";
import { eq, and, asc, isNull, sql, inArray } from "drizzle-orm";
import {
  subjectOfferings,
  subjects,
  users,
  enrollments,
  students,
  strands,
  studentSubjectEnrollments,
  gradingPeriodSystems,
} from "@/lib/db/schema";
import type { TermOffering } from "@/lib/constants/term-offerings";
import { getValidTermsForPeriod } from "@/lib/constants/term-offerings";
import type { GradingSystemType } from "@/lib/constants/grading-systems";
import { logger } from "@/lib/observability/logger";

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * Subject from subject offerings for grade entry grid.
 */
export type SubjectOfferingForGrades = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectUnits: string;
  isCore: boolean;
  sequenceOrder: number;
  teacherId: string | null;
  teacherName: string | null;
};

/**
 * Subject offering with strand info for SHS grade entry.
 */
export type SHSSubjectOffering = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectUnits: string;
  isCore: boolean;
  sequenceOrder: number;
  strandId: string | null;
  strandCode: string | null;
  termOffered: TermOffering;
  teacherId: string | null;
  teacherName: string | null;
};

/**
 * SHS grade entry subjects organized by category.
 */
export type SHSGradeEntrySubjects = {
  /** @deprecated Universal core subjects - empty in new model */
  universalCore: SHSSubjectOffering[];
  /** Track-specific subjects grouped by track code */
  strandSubjects: Map<string, SHSSubjectOffering[]>;
  /** All available tracks in this section */
  availableStrands: string[];
};

/**
 * Student in section with strand info for SHS grade entry.
 */
export type SHSSectionStudent = {
  id: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  fullName: string;
  enrollmentId: string;
  strandId: string | null;
  strandCode: string | null;
};

/**
 * Student with SSE info for grade entry grid.
 */
export type StudentWithSSE = {
  id: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  fullName: string;
  enrollmentId: string;
  strandId: string | null;
  strandCode: string | null;
  /** Map of subjectId -> studentSubjectEnrollmentId */
  subjectEnrollments: Map<string, string>;
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Get the grading system type for a school year.
 *
 * Falls back to "quarterly" only when the school year has no
 * `gradingPeriodSystems` row — that is the documented default for an
 * unconfigured year. A lookup failure is NOT downgraded to "quarterly":
 * callers derive valid term filters from this value, so guessing here would
 * silently filter a trimester year's subject offerings to the wrong terms.
 * Log and rethrow instead, and let the caller fail visibly.
 */
export async function getGradingSystemType(schoolYearId: string): Promise<GradingSystemType> {
  try {
    const config = await db.query.gradingPeriodSystems.findFirst({
      where: eq(gradingPeriodSystems.schoolYearId, schoolYearId),
      columns: { systemType: true },
    });
    return (config?.systemType as GradingSystemType) ?? "quarterly";
  } catch (error) {
    logger.error("[grades] Failed to resolve grading system type", {
      error,
      schoolYearId,
    });
    throw error;
  }
}

// ─── Subject Offering Queries ────────────────────────────────────────────────

/**
 * Get subjects for a section from subject offerings.
 * Returns null if no subject offerings exist (fallback to curriculum-based).
 */
export async function getSubjectsFromOfferingsForSection(
  sectionId: string,
  schoolYearId: string,
  gradingPeriod?: string
): Promise<SubjectOfferingForGrades[] | null> {
  // Check if section has subject offerings
  const [offeringsExist] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subjectOfferings)
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    );

  if (!offeringsExist?.count || offeringsExist.count === 0) {
    return null;
  }

  const baseConditions = [
    eq(subjectOfferings.sectionId, sectionId),
    eq(subjectOfferings.schoolYearId, schoolYearId),
    eq(subjectOfferings.isActive, true),
    isNull(subjectOfferings.deletedAt),
    isNull(subjects.deletedAt),
  ];

  if (gradingPeriod) {
    const systemType = await getGradingSystemType(schoolYearId);
    const validTerms = getValidTermsForPeriod(gradingPeriod, systemType);
    baseConditions.push(inArray(subjectOfferings.termOffered, validTerms));
  }

  const rows = await db
    .select({
      id: subjectOfferings.id,
      subjectId: subjectOfferings.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      sequenceOrder: subjectOfferings.sequenceOrder,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .where(and(...baseConditions))
    .orderBy(asc(subjectOfferings.sequenceOrder), asc(subjects.name));

  return rows as SubjectOfferingForGrades[];
}

/**
 * Get subjects for SHS grade entry, organized by universal core vs strand-specific.
 *
 * This query handles the complexity of SHS subject assignments where:
 * - Core subjects (no strand) are offered to all students
 * - Strand-specific subjects are only for students in that strand
 * - The effective strand is determined by: subject.strandId ?? offering.strandId
 *
 * Performance: Fixed N+1 by using LEFT JOINs for strand codes and display order
 * directly in the initial query, eliminating 2 extra round-trips.
 *
 * @param sectionId - The section ID to fetch subjects for
 * @param schoolYearId - The school year context
 * @param gradingPeriod - Optional grading period to filter by term (Q1/Q2/T1/etc)
 * @returns SHSGradeEntrySubjects with universalCore (deprecated, empty) and strandSubjects map
 */
export async function getSubjectsForSHSGradeEntry(
  sectionId: string,
  schoolYearId: string,
  gradingPeriod?: string
): Promise<SHSGradeEntrySubjects | null> {
  const baseConditions = [
    eq(subjectOfferings.sectionId, sectionId),
    eq(subjectOfferings.schoolYearId, schoolYearId),
    eq(subjectOfferings.isActive, true),
    isNull(subjectOfferings.deletedAt),
    isNull(subjects.deletedAt),
  ];

  if (gradingPeriod) {
    const systemType = await getGradingSystemType(schoolYearId);
    const validTerms = getValidTermsForPeriod(gradingPeriod, systemType);
    baseConditions.push(inArray(subjectOfferings.termOffered, validTerms));
  }

  // Aliases for strand JOINs - subject strand vs offering strand
  const subjectStrand = strands;
  const offeringStrand = strands;

  // Single query with LEFT JOINs for strand codes - eliminates N+1 for strand lookup
  const rows = await db
    .select({
      id: subjectOfferings.id,
      subjectId: subjectOfferings.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      sequenceOrder: subjectOfferings.sequenceOrder,
      subjectStrandId: subjects.strandId,
      offeringStrandId: subjectOfferings.strandId,
      termOffered: subjectOfferings.termOffered,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
      // Strand info from subject's strandId (alias: subjectStrand)
      subjectStrandCode: sql<string | null>`CASE WHEN ${subjects.strandId} IS NOT NULL AND ss.deleted_at IS NULL THEN ss.code ELSE NULL END`,
      subjectStrandShortCode: sql<string | null>`CASE WHEN ${subjects.strandId} IS NOT NULL AND ss.deleted_at IS NULL THEN ss.short_code ELSE NULL END`,
      subjectStrandDisplayOrder: sql<number | null>`CASE WHEN ${subjects.strandId} IS NOT NULL AND ss.deleted_at IS NULL THEN ss.display_order ELSE NULL END`,
      // Strand info from offering's strandId (alias: offeringStrand)
      offeringStrandCode: sql<string | null>`CASE WHEN ${subjectOfferings.strandId} IS NOT NULL AND os.deleted_at IS NULL THEN os.code ELSE NULL END`,
      offeringStrandShortCode: sql<string | null>`CASE WHEN ${subjectOfferings.strandId} IS NOT NULL AND os.deleted_at IS NULL THEN os.short_code ELSE NULL END`,
      offeringStrandDisplayOrder: sql<number | null>`CASE WHEN ${subjectOfferings.strandId} IS NOT NULL AND os.deleted_at IS NULL THEN os.display_order ELSE NULL END`,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    // LEFT JOIN for subject's strand (aliased as ss)
    .leftJoin(
      sql`${subjectStrand} AS ss`,
      sql`${subjects.strandId} = ss.id`
    )
    // LEFT JOIN for offering's strand (aliased as os)
    .leftJoin(
      sql`${offeringStrand} AS os`,
      sql`${subjectOfferings.strandId} = os.id`
    )
    .where(and(...baseConditions))
    .orderBy(asc(subjectOfferings.sequenceOrder), asc(subjects.name));

  if (rows.length === 0) {
    return null;
  }

  // Build strand info map from JOIN results (no additional queries needed)
  const strandMap = new Map<string, { code: string; shortCode: string; displayOrder: number }>();
  for (const row of rows) {
    // Add subject strand info if present
    if (row.subjectStrandId && row.subjectStrandCode) {
      strandMap.set(row.subjectStrandId, {
        code: row.subjectStrandCode,
        shortCode: row.subjectStrandShortCode ?? row.subjectStrandCode,
        displayOrder: row.subjectStrandDisplayOrder ?? 999,
      });
    }
    // Add offering strand info if present
    if (row.offeringStrandId && row.offeringStrandCode) {
      strandMap.set(row.offeringStrandId, {
        code: row.offeringStrandCode,
        shortCode: row.offeringStrandShortCode ?? row.offeringStrandCode,
        displayOrder: row.offeringStrandDisplayOrder ?? 999,
      });
    }
  }

  // Group subjects by track
  const trackSubjects = new Map<string, SHSSubjectOffering[]>();
  const availableTracks = new Set<string>();
  const seenTrackCodes = new Map<string, Set<string>>();
  const coreSubjectsWithoutTrack: SHSSubjectOffering[] = [];
  const trackDisplayOrders = new Map<string, number>();

  for (const row of rows) {
    /**
     * Determine the effective strand for a subject offering.
     *
     * Precedence:
     * 1. Subject's own strandId (from subjects table) - subject is inherently strand-specific
     *    Example: "Applied Economics for STEM" has strandId set at the curriculum level
     * 2. Offering's strandId (from subjectOfferings) - subject offered for a specific strand
     *    Example: A general elective configured for HUMSS students only
     * 3. null - core subject available to all strands
     *    Example: "Oral Communication" is core for all SHS students
     *
     * This null-coalescing ensures strand-specific subjects are properly filtered
     * while core subjects (both nulls) are shown to all students.
     */
    const effectiveStrandId = row.subjectStrandId ?? row.offeringStrandId;
    const effectiveStrand = effectiveStrandId ? strandMap.get(effectiveStrandId) : null;
    const trackCode = effectiveStrand?.code ?? null;

    const offering: SHSSubjectOffering = {
      id: row.id,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      subjectCode: row.subjectCode,
      subjectUnits: row.subjectUnits,
      isCore: row.isCore,
      sequenceOrder: row.sequenceOrder,
      strandId: effectiveStrandId,
      strandCode: trackCode,
      termOffered: (row.termOffered as TermOffering) || "full_year",
      teacherId: row.teacherId,
      teacherName: row.teacherName,
    };

    if (trackCode) {
      availableTracks.add(trackCode);
      // Track display order for sorting (from JOIN results)
      if (effectiveStrand && !trackDisplayOrders.has(trackCode)) {
        trackDisplayOrders.set(trackCode, effectiveStrand.displayOrder);
      }
      if (!seenTrackCodes.has(trackCode)) {
        seenTrackCodes.set(trackCode, new Set<string>());
      }
      const seenForTrack = seenTrackCodes.get(trackCode)!;
      if (!seenForTrack.has(row.subjectCode)) {
        seenForTrack.add(row.subjectCode);
        const existing = trackSubjects.get(trackCode) || [];
        existing.push(offering);
        trackSubjects.set(trackCode, existing);
      }
    } else if (row.isCore) {
      coreSubjectsWithoutTrack.push(offering);
    }
  }

  // Add core subjects to all tracks
  for (const coreOffering of coreSubjectsWithoutTrack) {
    for (const trackCode of availableTracks) {
      if (!seenTrackCodes.has(trackCode)) {
        seenTrackCodes.set(trackCode, new Set<string>());
      }
      const seenForTrack = seenTrackCodes.get(trackCode)!;
      if (!seenForTrack.has(coreOffering.subjectCode)) {
        seenForTrack.add(coreOffering.subjectCode);
        const existing = trackSubjects.get(trackCode) || [];
        existing.push({ ...coreOffering, strandCode: trackCode });
        trackSubjects.set(trackCode, existing);
      }
    }
  }

  // Sort tracks by display order (from JOIN results, no extra query needed)
  const sortedTracks = Array.from(availableTracks).sort(
    (a, b) => (trackDisplayOrders.get(a) ?? 999) - (trackDisplayOrders.get(b) ?? 999)
  );

  return {
    universalCore: [],
    strandSubjects: trackSubjects,
    availableStrands: sortedTracks,
  };
}

// ─── Student Queries ─────────────────────────────────────────────────────────

/**
 * Get enrolled students in a section with their strand assignments.
 */
export async function getStudentsWithStrandsInSection(
  sectionId: string,
  schoolYearId: string
): Promise<SHSSectionStudent[]> {
  const rows = await db
    .select({
      id: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      fullName: sql<string>`${students.lastName} || ', ' || ${students.firstName}`,
      enrollmentId: enrollments.id,
      strandId: enrollments.strandId,
      strandCode: strands.code,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .leftJoin(strands, eq(enrollments.strandId, strands.id))
    .where(
      and(
        eq(enrollments.sectionId, sectionId),
        eq(enrollments.schoolYearId, schoolYearId),
        eq(enrollments.status, "enrolled"),
        isNull(students.deletedAt)
      )
    )
    .orderBy(asc(students.lastName), asc(students.firstName));

  return rows.map((row) => ({
    ...row,
    strandCode: row.strandCode ?? null,
  }));
}

/**
 * Get enrolled students with their SSE records for a section.
 */
export async function getStudentsWithSSEForSection(
  sectionId: string,
  schoolYearId: string
): Promise<StudentWithSSE[]> {
  const studentRows = await db
    .select({
      id: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      fullName: sql<string>`${students.lastName} || ', ' || ${students.firstName}`,
      enrollmentId: enrollments.id,
      strandId: enrollments.strandId,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.sectionId, sectionId),
        eq(enrollments.schoolYearId, schoolYearId),
        eq(enrollments.status, "enrolled"),
        isNull(students.deletedAt)
      )
    )
    .orderBy(asc(students.lastName), asc(students.firstName));

  if (studentRows.length === 0) {
    return [];
  }

  const enrollmentIds = studentRows.map((s) => s.enrollmentId);
  const sseRows = await db
    .select({
      enrollmentId: studentSubjectEnrollments.enrollmentId,
      subjectId: subjectOfferings.subjectId,
      sseId: studentSubjectEnrollments.id,
    })
    .from(studentSubjectEnrollments)
    .innerJoin(subjectOfferings, eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferings.id))
    .where(
      and(
        inArray(studentSubjectEnrollments.enrollmentId, enrollmentIds),
        eq(studentSubjectEnrollments.isActive, true),
        isNull(studentSubjectEnrollments.deletedAt),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    );

  const sseLookup = new Map<string, Map<string, string>>();
  for (const sse of sseRows) {
    if (!sseLookup.has(sse.enrollmentId)) {
      sseLookup.set(sse.enrollmentId, new Map());
    }
    sseLookup.get(sse.enrollmentId)!.set(sse.subjectId, sse.sseId);
  }

  return studentRows.map((student) => ({
    id: student.id,
    studentRef: student.studentRef,
    firstName: student.firstName,
    lastName: student.lastName,
    fullName: student.fullName,
    enrollmentId: student.enrollmentId,
    strandId: student.strandId,
    strandCode: null,
    subjectEnrollments: sseLookup.get(student.enrollmentId) ?? new Map(),
  }));
}
