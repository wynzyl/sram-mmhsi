import { db } from "@/lib/db";
import {
  enrollments,
  schoolYears,
  gradeLevels,
  type EnrollmentIntakeDocuments,
} from "@/lib/db/schema";
import { eq, desc, or, isNotNull, and } from "drizzle-orm";

/** One enrollment row that may have an intake document checklist (new/transferee or stored JSON). */
export type StudentRequirementsSnapshot = {
  enrollmentId: string;
  schoolYear: string;
  gradeLevel: string;
  studentType: string;
  enrollmentStatus: string;
  intakeDocuments: EnrollmentIntakeDocuments | null;
  recordedAt: Date;
};

/**
 * Enrollments that captured (or may capture) an intake checklist: new/transferee, or non-null intake JSON.
 */
export async function getStudentRequirementsSnapshots(
  studentId: string
): Promise<StudentRequirementsSnapshot[]> {
  const rows = await db
    .select({
      id: enrollments.id,
      createdAt: enrollments.createdAt,
      status: enrollments.status,
      studentType: enrollments.studentType,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
      intakeDocuments: enrollments.intakeDocuments,
    })
    .from(enrollments)
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        or(
          eq(enrollments.studentType, "new_student"),
          eq(enrollments.studentType, "transferee"),
          isNotNull(enrollments.intakeDocuments)
        )
      )
    )
    .orderBy(desc(enrollments.createdAt));

  return rows.map((e) => ({
    enrollmentId: e.id,
    schoolYear: e.schoolYear,
    gradeLevel: e.gradeLevel,
    studentType: e.studentType,
    enrollmentStatus: e.status,
    intakeDocuments: e.intakeDocuments,
    recordedAt: new Date(e.createdAt),
  }));
}
