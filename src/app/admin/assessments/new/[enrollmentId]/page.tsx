import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  feeSchedules,
  feeScheduleItems,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentDraftForm from "@/components/assessments/AssessmentDraftForm";

export const metadata: Metadata = { title: "Create Assessment" };

interface PageProps {
  params: Promise<{ enrollmentId: string }>;
}

export default async function NewAssessmentForEnrollmentPage({ params }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "assessments:create")) {
    redirect("/admin/assessments");
  }

  const { enrollmentId } = await params;

  const row = await db
    .select({
      enrollmentId: enrollments.id,
      status: enrollments.status,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      schoolYearId: enrollments.schoolYearId,
      gradeLevelId: enrollments.gradeLevelId,
      syLabel: schoolYears.label,
      gradeName: gradeLevels.name,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (row.length === 0) notFound();

  const e = row[0];
  if (e.status !== "pending") {
    redirect("/admin/assessments");
  }

  const schedule = await db.query.feeSchedules.findFirst({
    where: eq(feeSchedules.schoolYearId, e.schoolYearId),
    columns: { id: true, isActive: true },
  });

  let scheduleLines: {
    feeScheduleItemId: string;
    description: string;
    defaultAmount: string;
    isDiscount: boolean;
  }[] = [];

  if (schedule) {
    const items = await db
      .select()
      .from(feeScheduleItems)
      .where(eq(feeScheduleItems.feeScheduleId, schedule.id))
      .orderBy(asc(feeScheduleItems.order), asc(feeScheduleItems.createdAt));

    scheduleLines = items.map((item) => ({
      feeScheduleItemId: item.id,
      description: item.description,
      defaultAmount: String(item.amount),
      isDiscount: item.isDiscount,
    }));
  }

  const submitBlockedReason = !schedule
    ? "No fee schedule exists for this school year. Create one under Finance → Fee schedules with line items."
    : !schedule.isActive
      ? "The fee schedule for this school year is inactive. Activate it in Finance before assessing."
      : scheduleLines.length === 0
        ? "Add at least one fee line on the fee schedule before creating an assessment."
        : null;

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create assessment</h1>
          <p className="page-subtitle">
            Adjust amounts per student from the standard school-year fee catalog. Saving sets the
            enrollment to Assessed.
          </p>
        </div>
      </div>

      <AssessmentDraftForm
        enrollmentId={e.enrollmentId}
        studentLabel={`${e.lastName}, ${e.firstName} (${e.referenceNumber})`}
        schoolYearLabel={e.syLabel}
        gradeLabel={e.gradeName}
        scheduleLines={scheduleLines}
        submitBlockedReason={submitBlockedReason}
      />
    </div>
  );
}
