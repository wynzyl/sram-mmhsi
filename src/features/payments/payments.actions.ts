"use server";

/**
 * Payment Actions Module
 *
 * This file contains the core payment posting action.
 * Other actions are split into domain-focused files:
 * - actions/booklets.actions.ts: Receipt booklet management
 * - actions/void-payment.actions.ts: Payment voiding logic
 * - actions/cash-discount.actions.ts: Cash discount reversal and cascade fixes
 */

import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  receiptBooklets,
  payments,
  assessments,
  enrollments,
  invoices,
  discountRequests,
  studentDiscounts,
  assessmentItems,
} from "@/lib/db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { PostPaymentSchema, type PaymentFormState } from "./payments.schema";
import { parseFormData } from "@/lib/utils/form-validation";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import { formatStoredOrNumber, parseOrNumber } from "@/lib/utils/or-number";
import {
  assertEnrollmentAllowsPayment,
  hasActiveEnrollmentForSchoolYear,
} from "@/lib/utils/enrollment-payment";
import { ASSESSMENT_BALANCE_FULLY_PAID_EPSILON } from "@/lib/utils/assessment-billing";
import { lockReceiptBooklet } from "@/lib/utils/tx-helpers";
import { transitionToEnrolledOnPayment } from "@/lib/utils/enrollment-status";
import {
  applyAssessmentBalanceDelta,
  recalcAssessmentTotalsForDiscount,
} from "@/lib/utils/assessment-balance";
import { assertNoPendingCancellation } from "@/features/enrollments/enrollment-cancellation.queries";
import {
  getBookletIdsAssignedToOthers,
  checkFullPaymentCashDiscountEligibility,
  getDiscountTypeByCode,
} from "./payments.queries";
import { FULL_PAYMENT_DISCOUNT_CODE } from "@/lib/constants/discount-codes";
import { formatDiscountDescription } from "@/features/discounts/utils/discount-calculations";
import { applyCascadeAdjustmentsForCashDiscount } from "@/features/discounts/services/cascade-operations";

// ─────────────────────────────────────────────────────────────────
// Payment Posting
// ─────────────────────────────────────────────────────────────────

/**
 * Post a payment to an assessment.
 *
 * This is the core payment posting action that handles:
 * - Auto-assign OR (booklet mode) or manual OR entry (offline reconciliation)
 * - Cash discount application at payment time
 * - Cascade adjustments for existing tuition discounts
 * - Idempotent posting via UUID key
 * - Enrollment status transition (assessed → enrolled on first payment)
 *
 * Validates:
 * - User has payments:post permission
 * - Assessment exists and belongs to student
 * - Payment amount doesn't exceed balance
 * - No pending enrollment cancellation
 * - Booklet is accessible (not assigned to another user)
 * - OR number uniqueness (manual entry)
 * - Reference number uniqueness (for GCash/bank transfer)
 */
export async function postPaymentAction(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "payments:post")) {
    return { message: "You do not have permission to post payments." };
  }

  const result = parseFormData(PostPaymentSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const {
    studentId,
    assessmentId,
    bookletId,
    amount,
    paymentMethod,
    referenceNumber,
    remarks,
    idempotencyKey,
    isManualEntry,
    manualPaymentDate,
    manualOrNumber,
    applyCashDiscount,
  } = result.data;

  try {
    let orNumberToAssign: string | undefined;
    let bookletIdToAssign: string | undefined;
    let idempotentReplay = false;
    let cashDiscountApplied = false;
    let cashDiscountAmount = 0;

    await db.transaction(async (tx) => {
      // 0. Idempotent replay guard (F7): a retried submit with the same client
      // key returns the original payment instead of consuming a second OR —
      // no new payment, balance change, or audit entry.
      if (idempotencyKey) {
        const existingByKey = await tx.query.payments.findFirst({
          where: eq(payments.idempotencyKey, idempotencyKey),
          columns: { id: true, orNumber: true },
        });
        if (existingByKey) {
          orNumberToAssign = existingByKey.orNumber ?? undefined;
          idempotentReplay = true;
          return;
        }
      }

      // 1. Fetch Assessment & Verify Balance
      const assessment = await tx.query.assessments.findFirst({
        where: and(
          eq(assessments.id, assessmentId),
          eq(assessments.studentId, studentId)
        ),
      });

      if (!assessment) throw new Error("Assessment not found.");
      // Note: Payments are allowed after enrollment cancellation to enable settling
      // outstanding balances/clearances. The balance validation below prevents overpayment.
      if (assessment.transferredAt != null) {
        throw new Error(
          "PAYMENT_BLOCKED: This assessment's balance was transferred to a newer school year. All payments must be posted to the current year's assessment instead."
        );
      }
      if (Number(assessment.balance) < amount) {
        throw new Error("Payment amount exceeds the current balance.");
      }

      const enrollmentForPayment =
        assessment.enrollmentId != null
          ? await tx.query.enrollments.findFirst({
              where: eq(enrollments.id, assessment.enrollmentId),
              columns: { id: true, status: true },
            })
          : null;

      assertEnrollmentAllowsPayment(
        enrollmentForPayment?.status,
        enrollmentForPayment?.id ?? assessment.enrollmentId ?? null,
        assessment.enrollmentId ?? null
      );

      // If enrollment is cancelled, verify no active enrollment exists for the same school year.
      // The student should pay on the active enrollment instead.
      if (enrollmentForPayment?.status === "cancelled") {
        const hasActive = await hasActiveEnrollmentForSchoolYear(
          tx,
          assessment.studentId,
          assessment.schoolYearId,
          enrollmentForPayment.id
        );

        if (hasActive) {
          throw new Error(
            "CANCELLED_HAS_ACTIVE: Cannot post payment on cancelled enrollment. Student has an active enrollment for this school year — please process payment there instead."
          );
        }
      }

      // Check for pending cancellation request (blocks all payments)
      await assertNoPendingCancellation(assessment.enrollmentId, "record payment");

      if (referenceNumber) {
        const existingRef = await tx.query.payments.findFirst({
          where: eq(payments.referenceNumber, referenceNumber),
          columns: { id: true },
        });
        if (existingRef) {
          throw new Error(
            "REF_DUPLICATE: This reference number is already recorded on another payment. Each payment reference must be unique."
          );
        }
      }

      // ─── Manual Entry vs Auto-Assign OR ────────────────────────────────────
      if (isManualEntry) {
        // === MANUAL ENTRY PATH ===
        // 1. Parse and validate OR number format
        const parsed = parseOrNumber(manualOrNumber!);
        if (!parsed) {
          throw new Error("Invalid OR number format. Expected: 'XX 00000' (e.g. AK 00050).");
        }

        // 2. Find booklet containing this OR number
        const matchingBooklets = await tx
          .select({
            id: receiptBooklets.id,
            prefix: receiptBooklets.prefix,
            series: receiptBooklets.series,
            startNumber: receiptBooklets.startNumber,
            endNumber: receiptBooklets.endNumber,
            usageMode: receiptBooklets.usageMode,
            status: receiptBooklets.status,
          })
          .from(receiptBooklets)
          .where(
            and(
              eq(receiptBooklets.prefix, parsed.prefix),
              sql`${receiptBooklets.startNumber} <= ${parsed.sequence}`,
              sql`${receiptBooklets.endNumber} >= ${parsed.sequence}`
            )
          )
          .limit(1);

        const matchingBooklet = matchingBooklets[0];
        if (!matchingBooklet) {
          throw new Error(
            `MANUAL_OR_NO_BOOKLET: OR number ${manualOrNumber} does not belong to any registered booklet. ` +
            `Register the booklet (prefix ${parsed.prefix}, range including ${parsed.sequence}) first, or check the OR number.`
          );
        }

        // 2a. Reject inactive booklets (voided/exhausted) — only active booklets may be consumed
        if (matchingBooklet.status !== "active") {
          throw new Error(
            `MANUAL_OR_INACTIVE_BOOKLET: OR number ${manualOrNumber} belongs to booklet "${matchingBooklet.series}" ` +
            `which is ${matchingBooklet.status} and can no longer be used. Use an active booklet instead.`
          );
        }

        // 2b. Validate booklet usage mode - manual entry requires manual_only booklet
        if (matchingBooklet.usageMode !== "manual_only") {
          throw new Error(
            `MANUAL_OR_WRONG_MODE: OR number ${manualOrNumber} belongs to booklet "${matchingBooklet.series}" ` +
            `which is set for auto-assign only. Use a manual-entry booklet instead.`
          );
        }

        // 2c. Verify user can access this booklet (not assigned to someone else)
        const excludedBookletIds = await getBookletIdsAssignedToOthers(session.userId);
        if (excludedBookletIds.includes(matchingBooklet.id)) {
          throw new Error(
            `MANUAL_OR_BOOKLET_RESTRICTED: OR number ${manualOrNumber} belongs to booklet "${matchingBooklet.series}" ` +
            `which is assigned to another user. Use your assigned booklet or an unassigned one.`
          );
        }

        // 3. Lock the owning booklet row BEFORE the duplicate check so that
        // concurrent submissions of the same manual OR serialize here.
        const bookletForUpdate = await tx
          .select({
            nextNumber: receiptBooklets.nextNumber,
            startNumber: receiptBooklets.startNumber,
            endNumber: receiptBooklets.endNumber,
            prefix: receiptBooklets.prefix,
          })
          .from(receiptBooklets)
          .where(eq(receiptBooklets.id, matchingBooklet.id))
          .for("update")
          .limit(1)
          .then((rows) => rows[0]);

        // 4. Check OR number not already used (inside the locked section)
        const existingPayment = await tx.query.payments.findFirst({
          where: eq(payments.orNumber, manualOrNumber!),
          columns: { id: true },
        });
        if (existingPayment) {
          throw new Error(`MANUAL_OR_DUPLICATE: OR number ${manualOrNumber} is already recorded on another payment.`);
        }

        orNumberToAssign = manualOrNumber!;
        bookletIdToAssign = matchingBooklet.id;

        // 5. Update booklet's nextNumber if manual OR >= current nextNumber
        if (bookletForUpdate && parsed.sequence >= bookletForUpdate.nextNumber) {
          const consumedOrs = await tx
            .select({ orNumber: payments.orNumber })
            .from(payments)
            .where(
              and(
                eq(payments.bookletId, matchingBooklet.id),
                sql`${payments.orNumber} IS NOT NULL`
              )
            );

          const consumedSet = new Set<number>();
          for (const row of consumedOrs) {
            if (row.orNumber) {
              const parsedOr = parseOrNumber(row.orNumber);
              if (parsedOr) consumedSet.add(parsedOr.sequence);
            }
          }
          consumedSet.add(parsed.sequence);

          let newNextNumber = bookletForUpdate.nextNumber;
          while (
            newNextNumber <= bookletForUpdate.endNumber &&
            consumedSet.has(newNextNumber)
          ) {
            newNextNumber++;
          }

          if (newNextNumber !== bookletForUpdate.nextNumber) {
            const newStatus = newNextNumber > bookletForUpdate.endNumber ? "exhausted" : "active";
            await tx
              .update(receiptBooklets)
              .set({
                nextNumber: newNextNumber,
                status: newStatus,
                updatedBy: session.userId,
                updatedAt: new Date(),
              })
              .where(eq(receiptBooklets.id, matchingBooklet.id));
          }
        }
      } else {
        // === AUTO-ASSIGN PATH (existing logic) ===
        // 2a. Verify user can access this booklet (not assigned to someone else)
        const excludedBookletIds = await getBookletIdsAssignedToOthers(session.userId);
        if (excludedBookletIds.includes(bookletId!)) {
          throw new Error(
            "BOOKLET_ACCESS_DENIED: This booklet is assigned to another user and cannot be used."
          );
        }

        // 2b. Fetch Selected Active Booklet (locking it for update to prevent race conditions on OR number)
        const activeBooklet = await lockReceiptBooklet(tx, bookletId!, "active");

        if (!activeBooklet) {
          throw new Error("The selected receipt booklet is either invalid or no longer active. Please refresh and select another.");
        }

        bookletIdToAssign = activeBooklet.id;
        const currentNext = activeBooklet.nextNumber;
        const endNum = activeBooklet.endNumber;
        const bookletPrefix = String(activeBooklet.prefix ?? "").trim() || String(activeBooklet.series ?? "").trim();

        orNumberToAssign = formatStoredOrNumber(bookletPrefix, currentNext);

        // 3. Update Booklet Next Number / Status
        const nextNum = currentNext + 1;
        const newStatus = nextNum > endNum ? "exhausted" : "active";

        await tx
          .update(receiptBooklets)
          .set({
            nextNumber: nextNum,
            status: newStatus,
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(eq(receiptBooklets.id, bookletIdToAssign));
      }

      // 3.5. Apply Full Payment Cash Discount (if requested and eligible)
      let actualPaymentAmount = amount;
      const assessmentBalance = Number(assessment.balance);

      if (applyCashDiscount) {
        // Re-verify eligibility inside transaction (defensive)
        const eligibility = await checkFullPaymentCashDiscountEligibility(
          assessmentId,
          assessmentBalance
        );

        if (!eligibility.eligible) {
          throw new Error(
            `CASH_DISCOUNT_INELIGIBLE: ${eligibility.reason ?? "Not eligible for cash discount."}`
          );
        }

        // Fetch discount type
        const discountType = await getDiscountTypeByCode(FULL_PAYMENT_DISCOUNT_CODE);
        if (!discountType) {
          throw new Error(
            "CASH_DISCOUNT_NOT_CONFIGURED: Full payment cash discount type is not configured."
          );
        }

        const details = eligibility.discountDetails!;

        // Create a "virtual" discount request for audit trail
        const [cashDiscountRequest] = await tx
          .insert(discountRequests)
          .values({
            studentId,
            enrollmentId: assessment.enrollmentId!,
            discountTypeId: discountType.id,
            assessmentId,
            status: "approved",
            requestReason: "Full payment cash discount - auto-approved at payment time",
            requestedBy: session.userId,
            requestedAt: new Date(),
            decidedBy: session.userId,
            decidedAt: new Date(),
            baseAmount: String(details.baseAmount),
            calculatedAmount: String(details.cashDiscountAmount),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: discountRequests.id });

        // Create studentDiscounts snapshot
        const [studentDiscount] = await tx
          .insert(studentDiscounts)
          .values({
            studentId,
            assessmentId,
            discountRequestId: cashDiscountRequest.id,
            discountTypeCode: FULL_PAYMENT_DISCOUNT_CODE,
            discountTypeName: discountType.name,
            calculationType: discountType.calculationType,
            baseType: discountType.baseType,
            baseAmount: String(details.baseAmount),
            discountValue: String(details.discountValue),
            discountAmount: String(details.cashDiscountAmount),
            appliedAt: new Date(),
            appliedBy: session.userId,
          })
          .returning({ id: studentDiscounts.id });

        // Format discount description for assessment item
        const discountDescription = formatDiscountDescription({
          discountRequestId: cashDiscountRequest.id,
          discountTypeCode: FULL_PAYMENT_DISCOUNT_CODE,
          discountTypeName: discountType.name,
          baseType: discountType.baseType,
          baseAmount: details.baseAmount,
          calculationType: discountType.calculationType,
          discountValue: details.discountValue,
          discountAmount: details.cashDiscountAmount,
        });

        // Create negative assessment item (discount line)
        const [discountItem] = await tx
          .insert(assessmentItems)
          .values({
            assessmentId,
            description: discountDescription,
            amount: String(details.cashDiscountAmount),
            isDiscount: true,
            isRefundable: false,
            studentDiscountId: studentDiscount.id,
            createdBy: session.userId,
            updatedBy: session.userId,
          })
          .returning({ id: assessmentItems.id });

        // Link assessment item to student discount
        await tx
          .update(studentDiscounts)
          .set({ assessmentItemId: discountItem.id })
          .where(eq(studentDiscounts.id, studentDiscount.id));

        // Recalculate assessment totals (applies the discount to balance)
        await recalcAssessmentTotalsForDiscount(
          tx,
          assessmentId,
          details.cashDiscountAmount,
          "apply",
          session.userId
        );

        // 3.6. Apply Cascading Discount Adjustments
        const cascadeResult = await applyCascadeAdjustmentsForCashDiscount(
          tx,
          assessmentId,
          studentDiscount.id,
          details.cashDiscountAmount,
          session.userId,
          session.role
        );

        const totalCascadeAdjustment = cascadeResult.totalCascadeAdjustment;

        actualPaymentAmount = details.paymentRequired;
        cashDiscountApplied = true;
        cashDiscountAmount = details.cashDiscountAmount;

        // Audit the cash discount application
        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "cash_discount_applied",
          targetEntity: "student_discounts",
          targetId: studentDiscount.id,
          context: `Full payment cash discount applied at payment time`,
          newState: {
            discountRequestId: cashDiscountRequest.id,
            baseAmount: details.baseAmount,
            discountValue: details.discountValue,
            cashDiscountAmount: details.cashDiscountAmount,
            originalBalance: details.currentBalance,
            newBalance: details.newBalance,
            paymentRequired: details.paymentRequired,
            cascadeAdjustment: totalCascadeAdjustment,
          },
        });
      }

      // 4. Create Payment Record
      const [newPayment] = await tx
        .insert(payments)
        .values({
          studentId,
          assessmentId,
          bookletId: bookletIdToAssign,
          orNumber: orNumberToAssign,
          orStatus: "consumed",
          amount: String(actualPaymentAmount),
          paymentMethod,
          referenceNumber,
          paymentDate: isManualEntry ? manualPaymentDate! : new Date(),
          status: "posted",
          remarks: cashDiscountApplied
            ? `${remarks ?? ""} [Cash discount applied: ₱${cashDiscountAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}]`.trim()
            : remarks,
          idempotencyKey,
          isManualEntry,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: payments.id });

      // 5. Update Assessment Balance
      const { newBalance } = await applyAssessmentBalanceDelta(
        tx,
        assessmentId,
        actualPaymentAmount,
        assessment.cancelledAt,
        assessment.transferredAt,
        session.userId
      );

      // 5b. Auto-settle linked invoice if balance reaches zero
      if (newBalance <= ASSESSMENT_BALANCE_FULLY_PAID_EPSILON) {
        await tx
          .update(invoices)
          .set({
            status: "settled",
            settledAt: new Date(),
            updatedAt: new Date(),
            updatedBy: session.userId,
          })
          .where(
            and(
              eq(invoices.assessmentId, assessmentId),
              ne(invoices.status, "settled")
            )
          );
      }

      // 6. Check and Update Enrollment Status (assessed → enrolled on first payment)
      if (assessment.enrollmentId) {
        await transitionToEnrolledOnPayment(
          {
            tx,
            enrollmentId: assessment.enrollmentId,
            userId: session.userId,
            userRole: session.role,
          },
          `Payment posted: OR ${orNumberToAssign}`
        );
      }

      // 7. Audit Log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "payment_posted",
        targetEntity: "payments",
        targetId: newPayment.id,
        context: isManualEntry
          ? `Manual entry: OR ${orNumberToAssign}, dated ${manualPaymentDate!.toISOString().split("T")[0]}`
          : `OR: ${orNumberToAssign}`,
      }, { throwOnFail: true });
    });

    if (idempotentReplay) {
      return {
        success: true,
        message: `Payment already posted (duplicate submit ignored). OR Number: ${orNumberToAssign}`,
      };
    }

    // Note: revalidatePath removed as it blocks the response in production Docker.
    // The client calls router.refresh() after success or uses TanStack Query invalidation.
    invalidateTag(CACHE_TAGS.DASHBOARD);
    invalidateTag(CACHE_TAGS.ENROLLMENTS);

    const successMessage = cashDiscountApplied
      ? `Payment posted successfully. OR Number: ${orNumberToAssign}. Cash discount of ₱${cashDiscountAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} applied.`
      : `Payment posted successfully. OR Number: ${orNumberToAssign}`;

    return { success: true, message: successMessage };
  } catch (error: unknown) {
    const msg0 = error instanceof Error ? error.message : String(error);
    const detail0 =
      typeof error === "object" && error !== null && "detail" in error
        ? String((error as { detail?: unknown }).detail ?? "")
        : "";

    // Idempotency-key unique violation: the payment exists — report success
    if (idempotencyKey && `${msg0}${detail0}`.includes("idempotency_key")) {
      const existing = await db.query.payments.findFirst({
        where: eq(payments.idempotencyKey, idempotencyKey),
        columns: { orNumber: true },
      });
      if (existing) {
        return {
          success: true,
          message: `Payment already posted (duplicate submit ignored). OR Number: ${existing.orNumber}`,
        };
      }
    }

    logger.error("[cashier] Failed to post payment", { error: String(error) });

    const msg = error instanceof Error ? error.message : String(error);

    // Handle manual entry specific errors
    if (msg.startsWith("MANUAL_OR_NO_BOOKLET:")) {
      return {
        errors: {
          manualOrNumber: [msg.replace("MANUAL_OR_NO_BOOKLET: ", "")],
        },
      };
    }
    if (msg.startsWith("MANUAL_OR_DUPLICATE:")) {
      return {
        errors: {
          manualOrNumber: [msg.replace("MANUAL_OR_DUPLICATE: ", "")],
        },
      };
    }
    if (msg.startsWith("MANUAL_OR_WRONG_MODE:")) {
      return {
        errors: {
          manualOrNumber: [msg.replace("MANUAL_OR_WRONG_MODE: ", "")],
        },
      };
    }
    if (msg.startsWith("MANUAL_OR_INACTIVE_BOOKLET:")) {
      return {
        errors: {
          manualOrNumber: [msg.replace("MANUAL_OR_INACTIVE_BOOKLET: ", "")],
        },
      };
    }
    if (msg.startsWith("MANUAL_OR_BOOKLET_RESTRICTED:")) {
      return {
        errors: {
          manualOrNumber: [msg.replace("MANUAL_OR_BOOKLET_RESTRICTED: ", "")],
        },
      };
    }
    if (msg.startsWith("BOOKLET_ACCESS_DENIED:")) {
      return {
        errors: {
          bookletId: [msg.replace("BOOKLET_ACCESS_DENIED: ", "")],
        },
      };
    }

    // Cash discount errors
    if (msg.startsWith("CASH_DISCOUNT_INELIGIBLE:")) {
      return {
        message: msg.replace("CASH_DISCOUNT_INELIGIBLE: ", ""),
      };
    }
    if (msg.startsWith("CASH_DISCOUNT_NOT_CONFIGURED:")) {
      return {
        message: msg.replace("CASH_DISCOUNT_NOT_CONFIGURED: ", ""),
      };
    }

    // Cancelled enrollment with active enrollment for same school year
    if (msg.startsWith("CANCELLED_HAS_ACTIVE:")) {
      return {
        message: msg.replace("CANCELLED_HAS_ACTIVE: ", ""),
      };
    }

    if (msg.startsWith("REF_DUPLICATE:")) {
      return {
        errors: {
          referenceNumber: ["This reference number is already used by another payment."],
        },
      };
    }

    const combined =
      msg +
      (typeof error === "object" && error !== null && "detail" in error
        ? String((error as { detail?: unknown }).detail ?? "")
        : "");
    if (
      combined.includes("reference_number") &&
      (combined.includes("already exists") ||
        combined.includes("duplicate key") ||
        combined.includes("unique constraint"))
    ) {
      return {
        errors: {
          referenceNumber: ["This reference number is already used by another payment."],
        },
      };
    }

    // Backstop for the OR-number partial unique index
    if (
      (combined.includes("payments_or_number_idx") || combined.includes("or_number")) &&
      (combined.includes("already exists") ||
        combined.includes("duplicate key") ||
        combined.includes("unique constraint"))
    ) {
      return {
        errors: {
          manualOrNumber: ["This OR number is already recorded on another payment."],
        },
      };
    }

    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}
