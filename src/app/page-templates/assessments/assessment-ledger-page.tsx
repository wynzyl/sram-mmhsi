import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  assessments,
  assessmentItems,
  payments,
  students,
  schoolYears,
  receiptBooklets,
  users,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, desc, asc, and, lte } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentLedgerRegister from "@/features/payments/components/AssessmentLedgerRegister";
import { getPendingVoidRequestsForPayments } from "@/features/payments/void-requests.queries";

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
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
      transferredAt: assessments.transferredAt,
      transferredToAssessmentId: assessments.transferredToAssessmentId,
      studentName: students.lastName,
      studentFirstName: students.firstName,
      schoolYear: schoolYears.label,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .where(eq(assessments.id, id))
    .limit(1)
    .then((res) => res[0]);

  if (!assessment) notFound();

  // Get BALANCE_FORWARD fee type ID for visual indicators
  const balanceForwardType = await db.query.feeItemTypes.findFirst({
    where: eq(feeItemTypes.code, "BALANCE_FORWARD"),
    columns: { id: true },
  });

  const items = await db
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
    .orderBy(desc(assessmentItems.createdAt));

  const paymentRecords = await db
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
    })
    .from(payments)
    .leftJoin(users, eq(payments.createdBy, users.id))
    .where(eq(payments.assessmentId, id))
    .orderBy(desc(payments.createdAt));

  const canPost = hasPermission(session.role, "payments:post");
  const canRequestVoid = hasPermission(session.role, "payments:void_request");

  // Fetch pending void requests for displayed payments
  const paymentIds = paymentRecords.map((p) => p.id);
  const pendingVoidMap = paymentIds.length > 0
    ? await getPendingVoidRequestsForPayments(paymentIds)
    : new Map();

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
  if (canPost) {
    activeBooklets = await db
      .select({
        id: receiptBooklets.id,
        series: receiptBooklets.series,
        prefix: receiptBooklets.prefix,
        nextNumber: receiptBooklets.nextNumber,
        endNumber: receiptBooklets.endNumber,
      })
      .from(receiptBooklets)
      .where(
        and(
          eq(receiptBooklets.status, "active"),
          lte(receiptBooklets.nextNumber, receiptBooklets.endNumber)
        )
      )
      .orderBy(asc(receiptBooklets.createdAt));
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
  }));

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
        }}
        items={items}
        payments={ledgerPayments}
        activeBooklets={activeBooklets}
        canPost={canPost}
        canRequestVoid={canRequestVoid}
        pendingVoidByPaymentId={pendingVoidByPaymentId}
        currentUserId={session.userId}
        balanceForwardTypeId={balanceForwardType?.id ?? null}
      />
    </div>
  );
}
