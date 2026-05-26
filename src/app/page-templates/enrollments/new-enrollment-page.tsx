import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { students, schoolYears, gradeLevels, enrollments } from "@/lib/db/schema";
import { eq, asc, desc, ne, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { EnrollmentWizardForm } from "@/features/enrollments";
import { getRegistrationContextByStudentIdForSchoolYear } from "@/features/enrollments/enrollment-registration-context.queries";

export async function InternalNewEnrollmentPage(props: {
  searchParams: Promise<{ studentId?: string; registrationId?: string }>;
  enrollmentsListPath: "/staff/enrollments";
  deniedRedirect: string;
}) {
  const { searchParams, enrollmentsListPath, deniedRedirect } = props;
  const session = await requireSession();
  if (!hasPermission(session.role, "enrollments:create")) redirect(deniedRedirect);

  const { studentId, registrationId: registrationIdParam } = await searchParams;

  const allStudents = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      previousSchool: students.previousSchool,
    })
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(asc(students.lastName), asc(students.firstName));

  const activeSyRows = await db
    .select({ id: schoolYears.id, label: schoolYears.label })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);

  const currentSchoolYear = activeSyRows[0] ?? null;

  type PriorRow = {
    studentId: string;
    gradeLevelId: string;
    gradeName: string;
    gradeOrder: number;
  };

  const [glRows, priorEnrollmentRows] = await Promise.all([
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name, order: gradeLevels.order })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.order)),
    currentSchoolYear != null
      ? db
          .select({
            studentId: enrollments.studentId,
            gradeLevelId: enrollments.gradeLevelId,
            gradeName: gradeLevels.name,
            gradeOrder: gradeLevels.order,
          })
          .from(enrollments)
          .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
          .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
          .where(
            and(ne(enrollments.status, "cancelled"), ne(enrollments.schoolYearId, currentSchoolYear.id))
          )
          .orderBy(desc(schoolYears.startDate))
      : Promise.resolve([] as PriorRow[]),
  ]);

  const latestPriorEnrollmentByStudent = new Map<
    string,
    { gradeLevelId: string; gradeName: string; order: number }
  >();
  for (const row of priorEnrollmentRows) {
    if (!latestPriorEnrollmentByStudent.has(row.studentId)) {
      latestPriorEnrollmentByStudent.set(row.studentId, {
        gradeLevelId: row.gradeLevelId,
        gradeName: row.gradeName,
        order: row.gradeOrder,
      });
    }
  }

  const promotionByStudentId: Record<
    string,
    {
      lastGradeLevelId: string;
      lastGradeName: string;
      nextGradeLevelId: string;
      hasNextGradeLevel: boolean;
    }
  > = {};

  for (const [sid, last] of latestPriorEnrollmentByStudent) {
    const nextOrder = last.order + 1;
    const nextGrade = glRows.find((g) => g.order === nextOrder);
    promotionByStudentId[sid] = {
      lastGradeLevelId: last.gradeLevelId,
      lastGradeName: last.gradeName,
      nextGradeLevelId: nextGrade?.id ?? last.gradeLevelId,
      hasNextGradeLevel: !!nextGrade,
    };
  }

  let prefillStudent: (typeof allStudents)[0] | null = null;
  if (studentId) {
    prefillStudent = allStudents.find((s) => s.id === studentId) ?? null;
  }

  const registrationContextByStudentId =
    currentSchoolYear != null
      ? await getRegistrationContextByStudentIdForSchoolYear(currentSchoolYear.id, {
          preferredRegistrationId: registrationIdParam ?? undefined,
          preferredStudentId: studentId ?? undefined,
        })
      : {};

  return (
    <div className="page-container">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
      >
        <Link href={enrollmentsListPath} className="hover:text-foreground">
          Enrollments
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">New enrollment</span>
      </nav>

      <header className="mb-8 max-w-3xl">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Enrollment Workflow
        </p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-foreground">
          Place a student
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Enrollments use the <strong className="text-foreground">current active school year</strong>{" "}
          only. The record begins as <strong className="text-foreground">Pending</strong> until the
          finance officer assesses fees.
        </p>
      </header>

      <EnrollmentWizardForm
        students={allStudents}
        currentSchoolYear={currentSchoolYear}
        gradeLevels={glRows}
        promotionByStudentId={promotionByStudentId}
        registrationContextByStudentId={registrationContextByStudentId}
        prefillStudentId={prefillStudent?.id ?? null}
        afterSuccessRedirect={enrollmentsListPath}
      />
    </div>
  );
}
