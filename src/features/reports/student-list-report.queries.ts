import { db } from "@/lib/db";
import {
  students,
  enrollments,
  gradeLevels,
  studentGuardianLinks,
  parentsGuardians,
} from "@/lib/db/schema";
import { eq, and, asc, isNull, sql } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StudentListRow = {
  studentId: string;
  studentName: string; // "DELA CRUZ, Juan Miguel" (Lastname, Firstname Middlename)
  gradeLevel: string;
  address: string; // student address
  guardianName: string; // primary guardian "Juan Dela Cruz"
  guardianContact: string;
  guardianEmail: string;
};

export type StudentListParams = {
  schoolYearId: string;
  gradeLevelId?: string;
  page?: number;
  pageSize?: number;
};

export type StudentListResult = {
  rows: StudentListRow[];
  totalCount: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * One primary guardian per student (DISTINCT ON), so the masterlist join never
 * multiplies student rows when a student has several guardian links.
 */
function primaryGuardianSubquery() {
  return db
    .selectDistinctOn([studentGuardianLinks.studentId], {
      studentId: studentGuardianLinks.studentId,
      firstName: parentsGuardians.firstName,
      lastName: parentsGuardians.lastName,
      contactNumber: parentsGuardians.contactNumber,
      email: parentsGuardians.email,
    })
    .from(studentGuardianLinks)
    .innerJoin(
      parentsGuardians,
      and(
        eq(parentsGuardians.id, studentGuardianLinks.guardianId),
        isNull(parentsGuardians.deletedAt),
      ),
    )
    .where(
      and(
        eq(studentGuardianLinks.isPrimary, true),
        isNull(studentGuardianLinks.deletedAt),
      ),
    )
    .orderBy(studentGuardianLinks.studentId, studentGuardianLinks.createdAt)
    .as("primary_guardian");
}

function enrollmentConditions(schoolYearId: string, gradeLevelId?: string) {
  return and(
    eq(enrollments.schoolYearId, schoolYearId),
    eq(enrollments.status, "enrolled"),
    isNull(students.deletedAt),
    gradeLevelId ? eq(enrollments.gradeLevelId, gradeLevelId) : undefined,
  );
}

function mapRow(row: {
  studentId: string;
  studentFirstName: string;
  studentMiddleName: string | null;
  studentLastName: string;
  gradeLevel: string;
  studentAddress: string | null;
  guardianFirstName: string | null;
  guardianLastName: string | null;
  guardianContact: string | null;
  guardianEmail: string | null;
}): StudentListRow {
  const guardianName =
    row.guardianFirstName || row.guardianLastName
      ? `${row.guardianFirstName ?? ""} ${row.guardianLastName ?? ""}`.trim()
      : "";

  // "LASTNAME, Firstname Middlename" (middle name omitted when absent).
  const firstAndMiddle = `${row.studentFirstName}${
    row.studentMiddleName ? ` ${row.studentMiddleName}` : ""
  }`;

  return {
    studentId: row.studentId,
    studentName: `${row.studentLastName}, ${firstAndMiddle}`,
    gradeLevel: row.gradeLevel,
    address: row.studentAddress ?? "",
    guardianName,
    guardianContact: row.guardianContact ?? "",
    guardianEmail: row.guardianEmail ?? "",
  };
}

const SELECT_SHAPE = (guardian: ReturnType<typeof primaryGuardianSubquery>) => ({
  studentId: students.id,
  studentFirstName: students.firstName,
  studentMiddleName: students.middleName,
  studentLastName: students.lastName,
  gradeLevel: gradeLevels.name,
  studentAddress: students.address,
  guardianFirstName: guardian.firstName,
  guardianLastName: guardian.lastName,
  guardianContact: guardian.contactNumber,
  guardianEmail: guardian.email,
});

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Paginated student masterlist for the on-screen preview.
 * Enrolled students for the given school year, optionally filtered by grade.
 */
export async function getStudentListReport(
  params: StudentListParams,
): Promise<StudentListResult> {
  const { schoolYearId, gradeLevelId } = params;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const guardian = primaryGuardianSubquery();

  const [results, countResult] = await Promise.all([
    db
      .select(SELECT_SHAPE(guardian))
      .from(students)
      .innerJoin(enrollments, eq(enrollments.studentId, students.id))
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .leftJoin(guardian, eq(guardian.studentId, students.id))
      .where(enrollmentConditions(schoolYearId, gradeLevelId))
      .orderBy(asc(gradeLevels.order), asc(students.lastName), asc(students.firstName))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(students)
      .innerJoin(enrollments, eq(enrollments.studentId, students.id))
      .where(enrollmentConditions(schoolYearId, gradeLevelId))
      .then((r) => r[0]),
  ]);

  return {
    rows: results.map(mapRow),
    totalCount: countResult?.count ?? 0,
  };
}

/**
 * All enrolled students for export (no pagination). Capped at 5000 rows to
 * match the other reports' memory guard.
 */
export async function getAllStudentListData(params: {
  schoolYearId: string;
  gradeLevelId?: string;
}): Promise<StudentListRow[]> {
  const MAX_EXPORT_ROWS = 5000;
  const { schoolYearId, gradeLevelId } = params;
  const guardian = primaryGuardianSubquery();

  const results = await db
    .select(SELECT_SHAPE(guardian))
    .from(students)
    .innerJoin(enrollments, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(guardian, eq(guardian.studentId, students.id))
    .where(enrollmentConditions(schoolYearId, gradeLevelId))
    .orderBy(asc(gradeLevels.order), asc(students.lastName), asc(students.firstName))
    .limit(MAX_EXPORT_ROWS);

  return results.map(mapRow);
}
