import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  assessments,
  assessmentItems,
  payments,
  students,
  schoolYears,
  users,
  feeItemTypes,
  enrollments,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentLedgerRegister from "@/features/payments/components/AssessmentLedgerRegister";
import { getPendingVoidRequestsForPayments } from "@/features/payments/void-requests.queries";
import {
  getAccessibleBookletsForUser,
  getCashierDefaultBookletId,
  getManualEntrySuggestions,
} from "@/features/payments/payments.queries";
import { getStudentDiscountsByAssessment } from "@/features/discounts";
import { isArchivedStatus } from "@/lib/constants/student-status";

export async function InternalAssessmentLedgerPage(props: {
  assessmentId: string;
  deniedRedirect: string;
  studentRecordsBasePath?: string;
}) {
  const { assessmentId: id, deniedRedirect, studentRecordsBasePath } = props;
  const session = await requireSession();

  if (!hasPermission(session.role, "assessments:read")) {
    redirect(deniedRedirect);
  }

  const assessment = await db
    .select({
      id: assessments.id,
      studentId: assessments.studentId,
      enrollmentId: assessments.enrollmentId,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
      transferredAt: assessments.transferredAt,
      transferredToAssessmentId: assessments.transferredToAssessmentId,
      studentName: students.lastName,
      studentFirstName: students.firstName,
      studentStatus: students.status,
      schoolYear: schoolYears.label,
      enrollmentStatus: enrollments.status,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .where(eq(assessments.id, id))
    .limit(1)
    .then((res) => res[0]);

  if (!assessment) notFound();

  // Run independent queries in parallel for better performance
  const [balanceForwardType, items, paymentRecords] = await Promise.all([
    // Get BALANCE_FORWARD fee type ID for visual indicators
    db.query.feeItemTypes.findFirst({
      where: eq(feeItemTypes.code, "BALANCE_FORWARD"),
      columns: { id: true },
    }),
    // Fetch assessment line items
    db
      .select({
        id: assessmentItems.id,
        description: assessmentItems.description,
        amount: assessmentItems.amount,
        isDiscount: assessmentItems.isDiscount,
        feeItemTypeId: assessmentItems.feeItemTypeId,
        sourceAssessmentId: assessmentItems.sourceAssessmentId,
      })
      .from(assessmentItems)
      .where(eq(assessmentItems.assessmentId, id))
      .orderBy(desc(assessmentItems.createdAt)),
    // Fetch payment records
    db
      .select({
        id: payments.id,
        orNumber: payments.orNumber,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paymentDate: payments.paymentDate,
        status: payments.status,
        referenceNumber: payments.referenceNumber,
        processedByUsername: users.username,
        kind: payments.kind,
        reversesPaymentId: payments.reversesPaymentId,
        isManualEntry: payments.isManualEntry,
      })
      .from(payments)
      .leftJoin(users, eq(payments.createdBy, users.id))
      .where(eq(payments.assessmentId, id))
      .orderBy(desc(payments.createdAt)),
  ]);

  // Check if student is archived - disable transactional actions for archived students
  const isStudentArchived = isArchivedStatus(assessment.studentStatus);

  // Disable posting, voiding, and cancellation for archived students
  const canPost = hasPermission(session.role, "payments:post") && !isStudentArchived;
  const canRequestVoid = hasPermission(session.role, "payments:void_request") && !isStudentArchived;
  const canReverseDiscount = hasPermission(session.role, "discounts:manage") && !isStudentArchived;
  const canRequestDiscount = hasPermission(session.role, "discounts:request") && !isStudentArchived;
  const canCancel = hasPermission(session.role, "assessments:cancel") && !isStudentArchived;

  // Fetch pending void requests for displayed payments + applied discounts in parallel
  const paymentIds = paymentRecords.map((p) => p.id);
  const [pendingVoidMap, appliedDiscounts] = await Promise.all([
    paymentIds.length > 0
      ? getPendingVoidRequestsForPayments(paymentIds)
      : Promise.resolve(new Map()),
    // Gracefully handle missing student_discounts table (migrations may not be applied)
    getStudentDiscountsByAssessment(id).catch(() => []),
  ]);

  // Convert map to record for serialization
  const pendingVoidByPaymentId: Record<string, {
    requestId: string;
    requestedBy: string;
    requestedByUsername: string;
  }> = {};
  for (const [paymentId, request] of pendingVoidMap) {
    pendingVoidByPaymentId[paymentId] = {
      requestId: request.requestId,
      requestedBy: request.requestedBy,
      requestedByUsername: request.requestedByUsername,
    };
  }

  let activeBooklets: {
    id: string;
    series: string;
    prefix: string;
    nextNumber: number;
    endNumber: number;
  }[] = [];
  let defaultBookletId: string | null = null;
  let manualSuggestions: Awaited<ReturnType<typeof getManualEntrySuggestions>> | null = null;

  if (canPost) {
    // Fetch accessible booklets, default booklet, and manual suggestions in parallel
    // Note: getAccessibleBookletsForUser() filters out booklets assigned to other users
    const [bookletRows, cashierDefaultBookletId, suggestions] = await Promise.all([
      // Get booklets accessible to this user (own assigned + unassigned booklets)
      getAccessibleBookletsForUser(session.userId),
      getCashierDefaultBookletId(session.userId),
      getManualEntrySuggestions(session.userId),
    ]);

    activeBooklets = bookletRows;
    defaultBookletId = cashierDefaultBookletId;
    manualSuggestions = suggestions;
  }

  const ledgerPayments = paymentRecords.map((p) => ({
    id: p.id,
    orNumber: p.orNumber,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate.toISOString(),
    status: p.status,
    referenceNumber: p.referenceNumber,
    processedBy: p.processedByUsername ?? null,
    kind: p.kind,
    reversesPaymentId: p.reversesPaymentId,
    isManualEntry: p.isManualEntry,
  }));

  // Compute most recent voidable payment ID for void request UI gating.
  // Only the most recent posted payment can be voided (accounting integrity).
  // paymentRecords is ordered by createdAt DESC, so first posted payment is most recent.
  const mostRecentVoidablePaymentId =
    paymentRecords.find(
      (p) => p.status === "posted" && p.kind === "payment"
    )?.id ?? null;

  return (
    <div className="page-container">
      <AssessmentLedgerRegister
        {...(studentRecordsBasePath != null ? { studentRecordsBasePath } : {})}
        assessment={{
          id: assessment.id,
          studentId: assessment.studentId,
          studentLastName: assessment.studentName,
          studentFirstName: assessment.studentFirstName,
          schoolYear: assessment.schoolYear,
          totalAmount: assessment.totalAmount,
          totalPaid: assessment.totalPaid,
          balance: assessment.balance,
          billingStatus: assessment.billingStatus,
          transferredAt: assessment.transferredAt?.toISOString() ?? null,
          transferredToAssessmentId: assessment.transferredToAssessmentId,
          enrollmentStatus: assessment.enrollmentStatus,
        }}
        items={items}
        payments={ledgerPayments}
        activeBooklets={activeBooklets}
        canPost={canPost}
        canRequestVoid={canRequestVoid}
        pendingVoidByPaymentId={pendingVoidByPaymentId}
        currentUserId={session.userId}
        balanceForwardTypeId={balanceForwardType?.id ?? null}
        enrollmentId={assessment.enrollmentId}
        appliedDiscounts={appliedDiscounts}
        canReverseDiscount={canReverseDiscount}
        canRequestDiscount={canRequestDiscount}
        canCancel={canCancel}
        defaultBookletId={defaultBookletId}
        manualSuggestions={manualSuggestions}
        mostRecentVoidablePaymentId={mostRecentVoidablePaymentId}
      />
    </div>
  );
}
