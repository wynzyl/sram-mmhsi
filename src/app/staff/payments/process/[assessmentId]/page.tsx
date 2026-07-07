import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  assessments,
  enrollments,
  gradeLevels,
  payments,
  schoolYears,
  students,
} from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { CashierPaymentProcessingView } from "@/features/payments/components/CashierPaymentProcessingView";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate } from "@/lib/utils/date";
import {
  getAccessibleBookletsForUser,
  getCashierDefaultBookletId,
  getManualEntrySuggestions,
} from "@/features/payments/payments.queries";

interface PageProps {
  params: Promise<{ assessmentId: string }>;
}

export const metadata: Metadata = {
  title: "Process Payment",
};

const dateLabel = (d: Date) =>
  formatDate(d, { year: "numeric", month: "short", day: "numeric" });

export default async function CashierProcessPaymentPage({ params }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "payments:post")) redirect("/login");

  const { assessmentId } = await params;

  const assessment = await db
    .select({
      id: assessments.id,
      studentId: assessments.studentId,
      enrollmentId: assessments.enrollmentId,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
      schoolYearLabel: schoolYears.label,
      gradeLevelName: gradeLevels.name,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      referenceNumber: students.referenceNumber,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(assessments.id, assessmentId))
    .limit(1)
    .then((r) => r[0]);

  if (!assessment) notFound();
  if (assessment.billingStatus === "cancelled") {
    redirect("/staff/payments");
  }

  // Fetch last payment, accessible booklets, default booklet, and manual suggestions in parallel
  // Note: getAccessibleBookletsForUser() filters out booklets assigned to other users
  const [lastPayment, activeBooklets, defaultBookletId, manualSuggestions] = await Promise.all([
    db
      .select({
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paymentDate: payments.paymentDate,
        orNumber: payments.orNumber,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.assessmentId, assessmentId))
      .orderBy(desc(payments.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),
    // Get booklets accessible to this user (own assigned + unassigned booklets)
    getAccessibleBookletsForUser(session.userId),
    getCashierDefaultBookletId(session.userId),
    getManualEntrySuggestions(),
  ]);

  return (
    <div className="page-container max-w-7xl">
      <CashierPaymentProcessingView
        assessmentId={assessment.id}
        studentId={assessment.studentId}
        studentName={`${assessment.studentLastName}, ${assessment.studentFirstName}`}
        referenceNumber={assessment.referenceNumber}
        gradeLevel={assessment.gradeLevelName}
        schoolYear={assessment.schoolYearLabel}
        totals={{
          totalAssessed: Number(assessment.totalAmount),
          totalPaid: Number(assessment.totalPaid),
          balance: Number(assessment.balance),
        }}
        lastPayment={
          lastPayment
            ? {
                amount: Number(lastPayment.amount),
                paymentMethod: lastPayment.paymentMethod,
                paymentDateLabel: dateLabel(lastPayment.paymentDate),
                orNumber: lastPayment.orNumber,
              }
            : null
        }
        activeBooklets={activeBooklets}
        defaultBookletId={defaultBookletId}
        manualSuggestions={manualSuggestions}
      />
    </div>
  );
}

