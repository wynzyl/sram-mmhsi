import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  sections,
  assessments,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getStudentDiscountsByAssessment,
  getDiscountRequestsByEnrollment,
  getActiveDiscountTypes,
  getDiscountRequestGate,
} from "@/features/discounts";
import EnrollmentDiscountsSection from "@/features/discounts/components/EnrollmentDiscountsSection";
import StudentDiscountsList from "@/features/discounts/components/StudentDiscountsList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function InternalEnrollmentDetailPage(props: {
  enrollmentId: string;
  deniedRedirect: string;
  studentRecordsBasePath?: string;
}) {
  const { enrollmentId, deniedRedirect, studentRecordsBasePath } = props;
  const session = await requireSession();

  if (!hasPermission(session.role, "enrollments:read")) {
    redirect(deniedRedirect);
  }

  const enrollment = await db
    .select({
      id: enrollments.id,
      status: enrollments.status,
      studentType: enrollments.studentType,
      createdAt: enrollments.createdAt,
      enrolledAt: enrollments.enrolledAt,
      cancelledAt: enrollments.cancelledAt,
      cancelRemarks: enrollments.cancelRemarks,
      studentId: students.id,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      schoolYearLabel: schoolYears.label,
      gradeLevelName: gradeLevels.name,
      sectionName: sections.name,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!enrollment) notFound();

  const [assessment] = await db
    .select({
      id: assessments.id,
      totalAmount: assessments.totalAmount,
      totalDiscounts: assessments.totalDiscounts,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
    })
    .from(assessments)
    .where(eq(assessments.enrollmentId, enrollmentId))
    .limit(1);

  const [appliedDiscounts, discountRequests, discountTypes, gate] =
    await Promise.all([
      assessment
        ? getStudentDiscountsByAssessment(assessment.id)
        : Promise.resolve([]),
      getDiscountRequestsByEnrollment(enrollmentId),
      getActiveDiscountTypes(),
      getDiscountRequestGate(enrollmentId),
    ]);

  const canRequestPermission = hasPermission(session.role, "discounts:request");
  const canRequest = canRequestPermission && gate.allowed;
  const requestBlockReason = !gate.allowed ? gate.reason : undefined;
  const canReverse = hasPermission(session.role, "discounts:manage");

  const studentBasePath = studentRecordsBasePath ?? "/staff/students";
  const studentName = `${enrollment.studentLastName}, ${enrollment.studentFirstName}`;

  return (
    <div className="page-container space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            <Link
              href={`${studentBasePath}/${enrollment.studentId}`}
              className="hover:underline"
            >
              {studentName}
            </Link>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <ReferenceCode code={enrollment.studentRef} />
            <span>·</span>
            <span>{enrollment.gradeLevelName}</span>
            {enrollment.sectionName && (
              <>
                <span>·</span>
                <span>{enrollment.sectionName}</span>
              </>
            )}
            <span>·</span>
            <span>{enrollment.schoolYearLabel}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span>Created {formatDate(enrollment.createdAt)}</span>
            {enrollment.enrolledAt && (
              <span>Enrolled {formatDate(enrollment.enrolledAt)}</span>
            )}
            {enrollment.cancelledAt && (
              <span>Cancelled {formatDate(enrollment.cancelledAt)}</span>
            )}
          </div>
        </div>
        <StatusBadge status={enrollment.status} type="enrollment" />
      </div>

      {enrollment.cancelRemarks && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <span className="font-medium">Cancellation note: </span>
            <span className="text-[var(--color-text-muted)]">
              {enrollment.cancelRemarks}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Assessment Card */}
      {assessment ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Assessment</CardTitle>
            <div className="flex items-center gap-3">
              <StatusBadge status={assessment.billingStatus} type="billing" />
              <Link href={`/staff/assessments/${assessment.id}`}>
                <Button variant="secondary" size="sm">
                  Open Ledger
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">Total</div>
                <div className="text-lg font-semibold">
                  <CurrencyDisplay amount={Number(assessment.totalAmount)} />
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">Discounts</div>
                <div className="text-lg font-semibold text-[var(--color-success)]">
                  -<CurrencyDisplay
                    amount={Number(assessment.totalDiscounts)}
                    className="inline"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">Paid</div>
                <div className="text-lg font-semibold">
                  <CurrencyDisplay amount={Number(assessment.totalPaid)} />
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">Balance</div>
                <div className="text-lg font-semibold">
                  <CurrencyDisplay amount={Number(assessment.balance)} />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--color-border)]">
              <h3 className="text-sm font-medium mb-3">Applied Discounts</h3>
              <StudentDiscountsList
                discounts={appliedDiscounts}
                canReverse={canReverse}
                canRequest={canRequest}
                requestBlockReason={requestBlockReason}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assessment</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              No assessment has been created for this enrollment yet.
            </p>
            {hasPermission(session.role, "assessments:create") && (
              <Link href={`/staff/assessments/new/${enrollment.id}`}>
                <Button variant="primary" size="sm">
                  Create Assessment
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Discount Requests Section */}
      <EnrollmentDiscountsSection
        studentId={enrollment.studentId}
        enrollmentId={enrollment.id}
        discountRequests={discountRequests}
        discountTypes={discountTypes}
        canRequest={canRequest}
        requestBlockReason={requestBlockReason}
      />
    </div>
  );
}
