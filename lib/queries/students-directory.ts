import { db } from "@/lib/db";
import { enrollments, gradeLevels, schoolYears, sections, students } from "@/lib/db/schema";
import { and, asc, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";

export const STUDENT_DIRECTORY_PAGE_SIZE = 20;

export type StudentDirectoryRow = {
  enrollmentId: string;
  id: string;
  referenceNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  address: string | null;
  telNumber: string | null;
  email: string | null;
  isActive: boolean;
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

  const searchWhere =
    qTrim !== ""
      ? or(
          ilike(students.firstName, `%${qTrim}%`),
          ilike(students.lastName, `%${qTrim}%`),
          ilike(students.referenceNumber, `%${qTrim}%`)
        )
      : undefined;

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
    ...(searchWhere ? [searchWhere] : [])
  );

  const [schoolYearOptions, gradeLevelOptions, listRows, countResult] = await Promise.all([
    db
      .select({ id: schoolYears.id, label: schoolYears.label })
      .from(schoolYears)
      .where(isNull(schoolYears.deletedAt))
      .orderBy(desc(schoolYears.startDate)),
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.order)),
    db
      .select({
        enrollmentId: sql<string>`${enrollments.id}`.as("enrollment_id"),
        id: students.id,
        referenceNumber: students.referenceNumber,
        firstName: students.firstName,
        middleName: students.middleName,
        lastName: students.lastName,
        address: students.address,
        telNumber: students.mobileNumber,
        email: students.email,
        isActive: students.isActive,
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
      .orderBy(
        asc(schoolYears.startDate),
        asc(students.lastName),
        asc(students.firstName),
        asc(gradeLevels.order),
        asc(enrollments.id)
      )
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
    middleName: r.middleName,
    lastName: r.lastName,
    address: r.address,
    telNumber: r.telNumber,
    email: r.email,
    isActive: r.isActive,
    schoolYearLabel: r.schoolYearLabel,
    gradeLevelName: r.gradeLevelName,
    sectionName: r.sectionName,
  }));

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
