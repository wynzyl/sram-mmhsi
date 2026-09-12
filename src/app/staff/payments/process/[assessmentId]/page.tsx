import type { Metadata } from "next";
import { Suspense } from "react";
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
import { requireStaffSession } from "@/lib/auth/session";
import { CashierPaymentProcessingView } from "@/features/payments/components/CashierPaymentProcessingView";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate } from "@/lib/utils/date";
import {
  getAccessibleBookletsForUser,
  getCashierDefaultBookletId,
  getManualEntrySuggestions,
  getAppliedCashDiscountDetails,
  checkCascadeFixNeeded,
} from "@/features/payments/payments.queries";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

interface PageProps {
  params: Promise<{ assessmentId: string }>;
}

export const metadata: Metadata = {
  title: "Process Payment",
};

const dateLabel = (d: Date) =>
  formatDate(d, { year: "numeric", month: "short", day: "numeric" });

/**
 * Instant navigation - sync shell with async content inside Suspense.
 */
export default function CashierProcessPaymentPage({ params }: PageProps) {
  return (
    <div className="page-container max-w-7xl">
      <Suspense fallback={<PaymentProcessingSkeleton />}>
        <PaymentProcessingWrapper params={params} />
      </Suspense>
    </div>
  );
}

async function PaymentProcessingWrapper({ params }: PageProps) {
  const { assessmentId } = await params;
  return <PaymentProcessingContent assessmentId={assessmentId} />;
}

function PaymentProcessingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-md p-4 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="bg-card border border-border rounded-md p-4 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="bg-card border border-border rounded-md p-4 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      {/* Form skeleton */}
      <div className="bg-card border border-border rounded-md p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}

async function PaymentProcessingContent({ assessmentId }: { assessmentId: string }) {
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "payments:post")) redirect("/login");

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

  // Fetch last payment, accessible booklets, default booklet, manual suggestions, applied discount, and cascade fix in parallel
  const [lastPayment, activeBooklets, defaultBookletId, manualSuggestions, appliedCashDiscount, cascadeFixData] = await Promise.all([
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
    getAccessibleBookletsForUser(session.userId),
    getCashierDefaultBookletId(session.userId),
    getManualEntrySuggestions(session.userId),
    getAppliedCashDiscountDetails(assessmentId),
    checkCascadeFixNeeded(assessmentId),
  ]);

  return (
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
      appliedCashDiscountDetails={appliedCashDiscount}
      cascadeFixData={cascadeFixData}
    />
  );
}

