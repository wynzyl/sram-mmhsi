import 'server-only';
import { db } from "@/lib/db";
import { enrollments, gradeLevels, schoolYears, sections, students } from "@/lib/db/schema";
import { and, asc, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import {
  STUDENT_DIRECTORY_PAGE_SIZE,
  type StudentSortBy,
  type StudentSortDir,
} from "@/lib/utils/student-directory-href";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { buildStudentSearchCondition } from "@/lib/utils/query-conditions";

export { STUDENT_DIRECTORY_PAGE_SIZE };

/**
 * @deprecated Use getActiveSchoolYearId from @/lib/queries/schoolYears instead.
 * Returns undefined instead of null for backwards compatibility.
 */
export async function fetchActiveSchoolYearId(): Promise<string | undefined> {
  const id = await getActiveSchoolYearId();
  return id ?? undefined;
}


export type StudentDirectoryRow = {
  enrollmentId: string;
  id: string;
  referenceNumber: string;
  firstName: string;
  lastName: string;
  address: string | null;
  telNumber: string | null;
  isActive: boolean;
  isSpecialEducation: boolean;
  schoolYearLabel: string | null;
  gradeLevelName: string | null;
  sectionName: string | null;
};

export type StudentDirectorySchoolYearOption = { id: string; label: string };
export type StudentDirectoryGradeLevelOption = { id: string; name: string };

export async function fetchStudentDirectoryPage(params: {
  q: string;
  page: number;
  schoolYearId?: string;
  gradeLevelId?: string;
  sortBy?: StudentSortBy;
  sortDir?: StudentSortDir;
}): Promise<{
  rows: StudentDirectoryRow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  schoolYearOptions: StudentDirectorySchoolYearOption[];
  gradeLevelOptions: StudentDirectoryGradeLevelOption[];
}> {
  const currentPage = Math.max(1, Number.isFinite(params.page) ? params.page : 1);
  const offset = (currentPage - 1) * STUDENT_DIRECTORY_PAGE_SIZE;
  const qTrim = params.q.trim();

  const searchWhere = buildStudentSearchCondition(qTrim);

  const enrollmentOnStudent = and(
    eq(enrollments.studentId, students.id),
    eq(enrollments.status, "enrolled"),
    ne(enrollments.status, "cancelled"),
    isNull(enrollments.cancelledAt),
    ...(params.schoolYearId != null ? [eq(enrollments.schoolYearId, params.schoolYearId)] : []),
    ...(params.gradeLevelId != null ? [eq(enrollments.gradeLevelId, params.gradeLevelId)] : [])
  );

  const schoolYearJoinOn = and(
    eq(enrollments.schoolYearId, schoolYears.id),
    isNull(schoolYears.deletedAt)
  );

  const studentListWhere = and(
    eq(students.isActive, true),
    eq(students.status, "active"),  // Filter out archived students
    ...(searchWhere ? [searchWhere] : [])
  );

  // ORDER BY: when a sort column is chosen, it leads, followed by stable
  // tiebreakers. With no sort, keep the original default ordering exactly.
  const orderDir = params.sortDir === "desc" ? desc : asc;
  const sortColumn = {
    name: students.lastName,
    tel: students.mobileNumber,
    status: students.isActive,
  };
  const orderBy: SQL[] = params.sortBy
    ? [
        orderDir(sortColumn[params.sortBy]),
        asc(students.lastName),
        asc(students.firstName),
        asc(enrollments.id),
      ]
    : [
        asc(schoolYears.startDate),
        asc(students.lastName),
        asc(students.firstName),
        asc(gradeLevels.order),
        asc(enrollments.id),
      ];

  const [schoolYearOptions, gradeLevelsData, listRows, countResult] = await Promise.all([
    db
      .select({ id: schoolYears.id, label: schoolYears.label })
      .from(schoolYears)
      .where(isNull(schoolYears.deletedAt))
      .orderBy(desc(schoolYears.startDate)),
    getGradeLevels(),  // Use centralized cached query to avoid duplication bug
    db
      .select({
        enrollmentId: sql<string>`${enrollments.id}`.as("enrollment_id"),
        id: students.id,
        referenceNumber: students.referenceNumber,
        firstName: students.firstName,
        lastName: students.lastName,
        address: students.address,
        telNumber: students.mobileNumber,
        isActive: students.isActive,
        isSpecialEducation: students.isSpecialEducation,
        schoolYearLabel: schoolYears.label,
        gradeLevelName: gradeLevels.name,
        sectionName: sections.name,
      })
      .from(students)
      .innerJoin(enrollments, enrollmentOnStudent)
      .innerJoin(schoolYears, schoolYearJoinOn)
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .leftJoin(sections, eq(enrollments.sectionId, sections.id))
      .where(studentListWhere)
      .orderBy(...orderBy)
      .limit(STUDENT_DIRECTORY_PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .innerJoin(enrollments, enrollmentOnStudent)
      .innerJoin(schoolYears, schoolYearJoinOn)
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .where(studentListWhere),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / STUDENT_DIRECTORY_PAGE_SIZE));

  const rows: StudentDirectoryRow[] = listRows.map((r) => ({
    enrollmentId: r.enrollmentId,
    id: r.id,
    referenceNumber: r.referenceNumber,
    firstName: r.firstName,
    lastName: r.lastName,
    address: r.address,
    telNumber: r.telNumber,
    isActive: r.isActive,
    isSpecialEducation: r.isSpecialEducation,
    schoolYearLabel: r.schoolYearLabel,
    gradeLevelName: r.gradeLevelName,
    sectionName: r.sectionName,
  }));

  // Map to expected format (getGradeLevels includes 'order' which we don't need)
  const gradeLevelOptions = gradeLevelsData.map(gl => ({ id: gl.id, name: gl.name }));

  return {
    rows,
    totalCount,
    totalPages,
    currentPage,
    schoolYearOptions,
    gradeLevelOptions,
  };
}

export function getStudentDirectoryEmptyMessage(
  q: string,
  schoolYearId?: string,
  gradeLevelId?: string
): string {
  const hasQ = q.trim() !== "";
  if (hasQ && schoolYearId && gradeLevelId) {
    return `No enrollments found matching "${q.trim()}" for the selected school year and grade.`;
  }
  if (hasQ && schoolYearId) {
    return `No enrollments found matching "${q.trim()}" for the selected school year.`;
  }
  if (hasQ && gradeLevelId) {
    return `No enrollments found matching "${q.trim()}" for the selected grade level.`;
  }
  if (hasQ) {
    return `No enrollments found matching "${q.trim()}".`;
  }
  if (schoolYearId && gradeLevelId) {
    return "No enrollments for the selected school year and grade level.";
  }
  if (schoolYearId) {
    return "No enrollments for the selected school year.";
  }
  if (gradeLevelId) {
    return "No enrollments for the selected grade level.";
  }
  return "No matching enrollments.";
}
