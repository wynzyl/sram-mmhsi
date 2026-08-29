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
  paymentAllocations,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentLedgerRegister from "@/features/payments/components/AssessmentLedgerRegister";
import { getPendingVoidRequestsForAssessment } from "@/features/payments/void-requests.queries";
import {
  getAccessibleBookletsForUser,
  getCashierDefaultBookletId,
  getManualEntrySuggestions,
} from "@/features/payments/payments.queries";
import { getStudentDiscountsByAssessment } from "@/features/discounts";
import { isArchivedStatus } from "@/lib/constants/student-status";
import { hasActiveEnrollmentForSchoolYear } from "@/lib/utils/enrollment-payment";
import SpecialEducationFeeManagement from "@/features/assessments/components/SpecialEducationFeeManagement";
import { SPED_FEE_CODE, isEffectivelySpecialEducation } from "@/lib/utils/special-education";
import { getSpedFeeAmount } from "@/features/settings/system-settings.actions";

export async function InternalAssessmentLedgerPage(props: {
  assessmentId: string;
  deniedRedirect: string;
  studentRecordsBasePath?: string;
}) {
  const { assessmentId: id, deniedRedirect, studentRecordsBasePath } = props;
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "assessments:read")) {
    redirect(deniedRedirect);
  }

  const assessment = await db
    .select({
      id: assessments.id,
      studentId: assessments.studentId,
      enrollmentId: assessments.enrollmentId,
      schoolYearId: assessments.schoolYearId,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
      transferredAt: assessments.transferredAt,
      transferredToAssessmentId: assessments.transferredToAssessmentId,
      studentName: students.lastName,
      studentFirstName: students.firstName,
      studentStatus: students.status,
      studentIsSpecialEducation: students.isSpecialEducation,
      schoolYear: schoolYears.label,
      enrollmentStatus: enrollments.status,
      enrollmentSpedOverride: enrollments.specialEducationOverride,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .where(eq(assessments.id, id))
    .limit(1)
    .then((res) => res[0]);

  if (!assessment) notFound();

  // Check if this is a cancelled enrollment with an active enrollment for the same school year.
  // If so, payments should be blocked (pay on the active enrollment instead).
  const cancelledWithActiveEnrollment =
    assessment.enrollmentStatus === "cancelled" &&
    (await hasActiveEnrollmentForSchoolYear(
      db,
      assessment.studentId,
      assessment.schoolYearId,
      assessment.enrollmentId
    ));

  // Check if student is archived - disable transactional actions for archived students
  const isStudentArchived = isArchivedStatus(assessment.studentStatus);

  // Disable posting, voiding, and cancellation for archived students
  const canPost = hasPermission(session.role, "payments:post") && !isStudentArchived;
  const canRequestVoid = hasPermission(session.role, "payments:void_request") && !isStudentArchived;
  const canReverseDiscount = hasPermission(session.role, "discounts:manage") && !isStudentArchived;
  const canRequestDiscount = hasPermission(session.role, "discounts:request") && !isStudentArchived;
  const canCancel = hasPermission(session.role, "assessments:cancel") && !isStudentArchived;

  // Performance: Run ALL independent queries in a single Promise.all
  // Previously had 3 sequential stages; now parallelized via assessmentId-based void query
  const [
    balanceForwardType,
    spedFeeType,
    items,
    paymentRecords,
    pendingVoidMap,
    appliedDiscounts,
    bookletRows,
    cashierDefaultBookletId,
    suggestions,
    defaultSpedFeeAmount,
  ] = await Promise.all([
    // Query 1: Get BALANCE_FORWARD fee type ID for visual indicators
    db.query.feeItemTypes.findFirst({
      where: eq(feeItemTypes.code, "BALANCE_FORWARD"),
      columns: { id: true },
    }),
    // Query 1b: Get SPED_FEE type ID for SPED fee management
    db.query.feeItemTypes.findFirst({
      where: eq(feeItemTypes.code, SPED_FEE_CODE),
      columns: { id: true },
    }),
    // Query 2: Fetch assessment line items
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
    // Query 3: Fetch payment records
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
    // Query 4: Pending void requests (now by assessmentId, no dependency on paymentIds)
    getPendingVoidRequestsForAssessment(id),
    // Query 5: Applied discounts (gracefully handle missing table)
    getStudentDiscountsByAssessment(id).catch(() => []),
    // Query 6: Booklets (conditional - empty if canPost is false)
    canPost ? getAccessibleBookletsForUser(session.userId) : Promise.resolve([]),
    // Query 7: Default booklet (conditional)
    canPost ? getCashierDefaultBookletId(session.userId) : Promise.resolve(null),
    // Query 8: Manual entry suggestions (conditional)
    canPost ? getManualEntrySuggestions(session.userId) : Promise.resolve(null),
    // Query 9: SPED fee amount from system settings
    getSpedFeeAmount(),
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

  const activeBooklets = bookletRows;
  const defaultBookletId = cashierDefaultBookletId;
  const manualSuggestions = suggestions;

  // Find existing SPED fee item and check for allocated payments
  const existingSpedItem = spedFeeType
    ? items.find((item) => item.feeItemTypeId === spedFeeType.id)
    : null;

  let hasSpedAllocatedPayments = false;
  if (existingSpedItem) {
    const spedAllocation = await db.query.paymentAllocations.findFirst({
      where: eq(paymentAllocations.assessmentItemId, existingSpedItem.id),
    });
    hasSpedAllocatedPayments = !!spedAllocation;
  }

  // Permission to modify assessments (add/remove SPED fee)
  const canModifyAssessment = hasPermission(session.role, "assessments:update") && !isStudentArchived;
  const isTransferred = assessment.transferredAt != null;
  const isAssessmentLocked =
    assessment.billingStatus === "cancelled" ||
    assessment.billingStatus === "fully_paid" ||
    isTransferred;

  // Check if this student is effectively a SPED student
  const isSpedStudent = isEffectivelySpecialEducation(
    { isSpecialEducation: assessment.studentIsSpecialEducation },
    { specialEducationOverride: assessment.enrollmentSpedOverride }
  );

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
    <div className="page-container--full">
      <AssessmentLedgerRegister
        spedFeeSlot={
          <SpecialEducationFeeManagement
            assessmentId={id}
            existingSpedItem={
              existingSpedItem
                ? { id: existingSpedItem.id, amount: existingSpedItem.amount }
                : null
            }
            hasAllocatedPayments={hasSpedAllocatedPayments}
            canModify={canModifyAssessment}
            isLocked={isAssessmentLocked}
            defaultSpedFeeAmount={defaultSpedFeeAmount}
            isSpedStudent={isSpedStudent}
          />
        }
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
        cancelledWithActiveEnrollment={cancelledWithActiveEnrollment}
      />
    </div>
  );
}
