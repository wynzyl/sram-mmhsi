"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  receiptBooklets,
  payments,
  assessments,
  enrollments,
  invoices,
  users,
} from "@/lib/db/schema";
import { eq, and, lte, gte, ne, sql, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateBookletSchema,
  formatBookletSeriesCanonical,
  PostPaymentSchema,
  VoidPaymentSchema,
} from "./payments.schema";
import { parseFormData } from "@/lib/utils/form-validation";
import type {
  BookletFormState,
  PaymentFormState,
  VoidPaymentFormState,
} from "./payments.schema";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import { formatStoredOrNumber, parseOrNumber } from "@/lib/utils/or-number";
import {
  assertEnrollmentAllowsPayment,
  hasActiveEnrollmentForSchoolYear,
} from "@/lib/utils/enrollment-payment";
import { ASSESSMENT_BALANCE_FULLY_PAID_EPSILON } from "@/lib/utils/assessment-billing";
import {
  lockReceiptBooklet,
  lockPayment,
  lockAssessment,
  assertAssessmentNotTransferred,
} from "@/lib/utils/tx-helpers";
import {
  transitionToEnrolledOnPayment,
  revertToAssessedOnVoid,
} from "@/lib/utils/enrollment-status";
import {
  applyAssessmentBalanceDelta,
  recalcAssessmentTotalsForDiscount,
  recalcAssessmentTotalsForCascade,
  reverseCascadeAdjustment,
} from "@/lib/utils/assessment-balance";
import { assertNoPendingCancellation } from "@/features/enrollments/enrollment-cancellation.queries";
import {
  assertStudentMutable,
  StudentArchivedException,
  formatArchiveError,
} from "@/features/archive/archive.guards";
import {
  getBookletIdsAssignedToOthers,
  checkFullPaymentCashDiscountEligibility,
  getDiscountTypeByCode,
  checkCascadeFixNeeded,
  FULL_PAYMENT_DISCOUNT_CODE,
} from "./payments.queries";
import type { CascadeFixFormState } from "./payments.types";
import {
  discountRequests,
  studentDiscounts,
  assessmentItems,
  discountTypes,
  schoolYears,
} from "@/lib/db/schema";
import {
  formatDiscountDescription,
  calculateDiscountBase,
} from "@/features/discounts/utils/discount-calculations";
import {
  calculateCascadeAdjustments,
  formatCascadeAdjustmentDescription,
  type StudentDiscountForCascade,
} from "@/features/discounts/utils/cascade-calculations";
import { feeItemTypes } from "@/lib/db/schema";

// ─── Receipt Booklets ────────────────────────────────────────────────────────

export async function createBookletAction(
  _prevState: BookletFormState,
  formData: FormData
): Promise<BookletFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "booklets:manage")) {
    return { message: "You do not have permission to manage OR booklets." };
  }

  const result = parseFormData(CreateBookletSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  const { startNumber, endNumber, usageMode, assignedCashierId } = parsed.data;
  const prefix = parsed.data.prefix.toUpperCase();
  const seriesCanonical = formatBookletSeriesCanonical(prefix, startNumber, endNumber);

  /** Closed-interval overlap: [s1,e1] ∩ [s2,e2] ≠ ∅ */
  const overlapping = await db
    .select({
      series: receiptBooklets.series,
      startNumber: receiptBooklets.startNumber,
      endNumber: receiptBooklets.endNumber,
    })
    .from(receiptBooklets)
    .where(
      and(
        eq(receiptBooklets.prefix, prefix),
        lte(receiptBooklets.startNumber, endNumber),
        gte(receiptBooklets.endNumber, startNumber)
      )
    )
    .limit(8);

  if (overlapping.length > 0) {
    const detail = overlapping
      .map(
        (row) =>
          `${row.series} (${row.startNumber}–${row.endNumber})`
      )
      .join("; ");
    return {
      errors: {
        _form: [
          `This OR number range overlaps another ${prefix} booklet: ${detail}. Ranges for the same prefix must not overlap.`,
        ],
      },
    };
  }

  try {
    const [newBooklet] = await db
      .insert(receiptBooklets)
      .values({
        series: seriesCanonical,
        prefix,
        startNumber,
        endNumber,
        nextNumber: startNumber,
        status: "active",
        usageMode,
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: receiptBooklets.id });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "booklet_created",
      targetEntity: "receipt_booklets",
      targetId: newBooklet.id,
      newState: {
        ...parsed.data,
        prefix,
        series: seriesCanonical,
        usageMode,
      },
    }, { throwOnFail: true });

    // If a cashier was selected, set this booklet as their default
    if (assignedCashierId) {
      await db
        .update(users)
        .set({
          defaultBookletId: newBooklet.id,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, assignedCashierId));

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "cashier_default_booklet_assigned",
        targetEntity: "users",
        targetId: assignedCashierId,
        newState: { defaultBookletId: newBooklet.id, bookletSeries: seriesCanonical },
      });
    }

    revalidatePath("/staff/finance/booklets");
    return { success: true, message: "Receipt booklet created successfully." };
  } catch (error) {
    logger.error("[cashier] Failed to create booklet", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function postPaymentAction(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const session = await requireSession();
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
        // concurrent submissions of the same manual OR serialize here. A manual
        // OR belongs to exactly one booklet (matched by prefix + range above),
        // so contenders for the same OR all block on this same row lock — the
        // duplicate check below then runs one-at-a-time, closing the TOCTOU
        // window between the read and the insert. (The partial unique index
        // `payments_or_number_idx` is the final backstop; see the catch path.)
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
        // This ensures the UI doesn't show already-consumed ORs as available
        if (bookletForUpdate && parsed.sequence >= bookletForUpdate.nextNumber) {
          // Find all consumed OR numbers in this booklet's range
          const consumedOrs = await tx
            .select({ orNumber: payments.orNumber })
            .from(payments)
            .where(
              and(
                eq(payments.bookletId, matchingBooklet.id),
                sql`${payments.orNumber} IS NOT NULL`
              )
            );

          // Parse consumed OR sequences into a Set for O(1) lookup
          const consumedSet = new Set<number>();
          for (const row of consumedOrs) {
            if (row.orNumber) {
              const parsedOr = parseOrNumber(row.orNumber);
              if (parsedOr) consumedSet.add(parsedOr.sequence);
            }
          }
          // Also include the one we're about to insert
          consumedSet.add(parsed.sequence);

          // Find the next available OR number in sequence
          let newNextNumber = bookletForUpdate.nextNumber;
          while (
            newNextNumber <= bookletForUpdate.endNumber &&
            consumedSet.has(newNextNumber)
          ) {
            newNextNumber++;
          }

          // Update booklet if nextNumber changed
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
        // Use the assessment's full balance for eligibility check, not the submitted amount
        // (the submitted amount may already be the discounted amount from the UI)
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
        // (Cash discounts bypass the normal approval workflow)
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
            amount: String(details.cashDiscountAmount), // Positive value, isDiscount flag controls sign
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
        // When cash discount is applied, recalculate existing tuition_only discounts
        // based on the discounted tuition amount (not the original tuition).
        let totalCascadeAdjustment = 0;

        // Fetch existing tuition_only discounts that may cascade
        const existingTuitionDiscounts = await tx
          .select({
            id: studentDiscounts.id,
            studentId: studentDiscounts.studentId,
            assessmentId: studentDiscounts.assessmentId,
            discountTypeCode: studentDiscounts.discountTypeCode,
            discountTypeName: studentDiscounts.discountTypeName,
            calculationType: studentDiscounts.calculationType,
            baseType: studentDiscounts.baseType,
            baseAmount: studentDiscounts.baseAmount,
            discountValue: studentDiscounts.discountValue,
            discountAmount: studentDiscounts.discountAmount,
            assessmentItemId: studentDiscounts.assessmentItemId,
            cascadeAdjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
          })
          .from(studentDiscounts)
          .where(
            and(
              eq(studentDiscounts.assessmentId, assessmentId),
              eq(studentDiscounts.baseType, "tuition_only"),
              isNull(studentDiscounts.reversedAt),
              // Exclude the cash discount we just created
              ne(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE)
            )
          );

        if (existingTuitionDiscounts.length > 0) {
          // Fetch assessment items for cascade calculation
          const itemsForCascade = await tx
            .select({
              id: assessmentItems.id,
              amount: assessmentItems.amount,
              isDiscount: assessmentItems.isDiscount,
              feeItemTypeCode: feeItemTypes.code,
            })
            .from(assessmentItems)
            .leftJoin(feeItemTypes, eq(assessmentItems.feeItemTypeId, feeItemTypes.id))
            .where(eq(assessmentItems.assessmentId, assessmentId));

          const itemsForCalc = itemsForCascade.map((r) => ({
            id: r.id,
            amount: r.amount,
            isDiscount: r.isDiscount,
            feeItemTypeCode: r.feeItemTypeCode,
          }));

          // Convert to cascade calculation format
          const discountsForCascade: StudentDiscountForCascade[] =
            existingTuitionDiscounts.map((d) => ({
              id: d.id,
              studentId: d.studentId,
              assessmentId: d.assessmentId,
              discountTypeCode: d.discountTypeCode,
              discountTypeName: d.discountTypeName,
              calculationType: d.calculationType as "fixed_amount" | "percentage",
              baseType: d.baseType as "tuition_only" | "full_assessment",
              baseAmount: d.baseAmount,
              discountValue: d.discountValue,
              discountAmount: d.discountAmount,
              assessmentItemId: d.assessmentItemId,
              cascadeAdjustmentAmount: d.cascadeAdjustmentAmount,
            }));

          // Calculate cascade adjustments
          const cascadeResult = calculateCascadeAdjustments(
            discountsForCascade,
            details.cashDiscountAmount,
            itemsForCalc
          );

          // Create cascade adjustment items and update student discounts
          for (const adj of cascadeResult.adjustments) {
            // Create positive assessment item (adds to balance)
            const adjustmentDescription = formatCascadeAdjustmentDescription(
              adj,
              adj.newBaseAmount
            );

            const [adjustmentItem] = await tx
              .insert(assessmentItems)
              .values({
                assessmentId,
                description: adjustmentDescription,
                amount: String(adj.adjustmentAmount),
                isDiscount: false, // Positive = adds to balance
                isRefundable: false,
                isCascadeAdjustment: true,
                adjustsItemId: adj.originalAssessmentItemId,
                createdBy: session.userId,
                updatedBy: session.userId,
              })
              .returning({ id: assessmentItems.id });

            // Update student discount with cascade tracking
            await tx
              .update(studentDiscounts)
              .set({
                cascadeAdjustmentAmount: String(adj.adjustmentAmount),
                cascadeTriggeredByDiscountId: studentDiscount.id,
              })
              .where(eq(studentDiscounts.id, adj.studentDiscountId));

            // Audit cascade adjustment
            await logAudit({
              actor: session.userId,
              actorRole: session.role,
              action: "cascade_discount_adjustment",
              targetEntity: "student_discounts",
              targetId: adj.studentDiscountId,
              context: `Cascade adjustment due to cash discount`,
              newState: {
                originalDiscountAmount: adj.originalDiscountAmount,
                recalculatedAmount: adj.recalculatedDiscountAmount,
                adjustmentAmount: adj.adjustmentAmount,
                triggeredByDiscountId: studentDiscount.id,
                adjustmentItemId: adjustmentItem.id,
              },
            });
          }

          totalCascadeAdjustment = cascadeResult.totalAdjustment;

          // Apply cascade adjustment to assessment balance
          if (totalCascadeAdjustment > 0) {
            await recalcAssessmentTotalsForCascade(
              tx,
              assessmentId,
              totalCascadeAdjustment,
              session.userId
            );
          }
        }

        // The actual payment amount is the new reduced balance (includes cascade)
        // details.paymentRequired already includes cascade adjustment from eligibility check
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
      // Note: actualPaymentAmount may differ from input `amount` if cash discount was applied
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
      // Note: If cash discount was applied, the balance was already adjusted in step 3.5
      // The payment now settles the reduced balance (actualPaymentAmount)
      const { newBalance } = await applyAssessmentBalanceDelta(
        tx,
        assessmentId,
        actualPaymentAmount, // positive = payment (may be reduced if discount applied)
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

      // 7. Audit Log (add manual entry context)
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
      // Original post already revalidated; just report the existing OR.
      return {
        success: true,
        message: `Payment already posted (duplicate submit ignored). OR Number: ${orNumberToAssign}`,
      };
    }

    revalidatePath(`/staff/assessments/${assessmentId}`);
    revalidatePath("/staff/finance/invoices");
    // Booklets page shows nextNumber; update it after any payment post (especially manual entries)
    revalidatePath("/staff/finance/booklets");
    // Dashboard KPIs reflect collections; an enrollment can flip to "enrolled" via payment.
    invalidateTag(CACHE_TAGS.DASHBOARD);
    // SWR is enough here: the cashier lands on /staff/payments next, which does
    // not render the enrollment-queue counts. A blocking updateTag() would force
    // getEnrollmentQueueCounts() to re-run inside this action response (slow
    // "Posting…" spinner) for data the actor never sees.
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

    // Idempotency-key unique violation (two replays racing): the payment
    // exists — re-read it and report success instead of an error.
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

    // Backstop for the OR-number partial unique index (`payments_or_number_idx`).
    // If two submissions still race past the in-transaction check, the DB
    // rejects the second insert — surface it as a manual OR field error.
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

export async function voidPaymentAction(
  _prevState: VoidPaymentFormState,
  formData: FormData
): Promise<VoidPaymentFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "payments:void")) {
    return { message: "You do not have permission to void payments." };
  }

  const result = parseFormData(VoidPaymentSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { paymentId, voidReason } = result.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch Payment (FOR UPDATE to prevent concurrent voiding)
      const payment = await lockPayment(tx, paymentId);

      if (!payment) {
        throw new Error("Payment not found.");
      }

      if (payment.status === "voided") {
        throw new Error("Payment is already voided.");
      }

      // Check if student is archived (blocked action - cannot void payments for archived students)
      await assertStudentMutable(payment.studentId, "void_or", tx);

      // Check for pending cancellation request (blocks voids too)
      if (payment.assessmentId) {
        const assessmentForCancel = await tx.query.assessments.findFirst({
          where: eq(assessments.id, payment.assessmentId),
          columns: { enrollmentId: true },
        });
        await assertNoPendingCancellation(assessmentForCancel?.enrollmentId, "void payment");
      }

      // 2. Mark Payment as Voided
      await tx
        .update(payments)
        .set({
          status: "voided",
          orStatus: "voided",
          voidedAt: new Date(),
          voidedBy: session.userId,
          voidReason,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      // 3. Revert Assessment Balance
      if (payment.assessmentId) {
        const assessment = await lockAssessment(tx, payment.assessmentId);
        if (assessment) {
          // Block voiding payments on transferred assessments
          assertAssessmentNotTransferred(assessment.transferredAt, "void payment");

          const pAmount = Number(payment.amount);

          // 3a. Check for cash discount associated with this payment
          // If this payment was posted with a cash discount, we need to:
          // 1. Reverse the cash discount itself
          // 2. Reverse any cascade adjustments that were created
          const cashDiscountOnPayment = await tx
            .select({
              id: studentDiscounts.id,
              discountAmount: studentDiscounts.discountAmount,
              assessmentItemId: studentDiscounts.assessmentItemId,
            })
            .from(studentDiscounts)
            .where(
              and(
                eq(studentDiscounts.assessmentId, payment.assessmentId),
                eq(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
                isNull(studentDiscounts.reversedAt)
              )
            )
            .limit(1);

          let totalCascadeReversalAmount = 0;

          if (cashDiscountOnPayment.length > 0) {
            const cashDiscount = cashDiscountOnPayment[0];

            // Find cascade adjustments triggered by this cash discount
            const cascadeAdjustments = await tx
              .select({
                studentDiscountId: studentDiscounts.id,
                cascadeAdjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
                assessmentItemId: studentDiscounts.assessmentItemId,
              })
              .from(studentDiscounts)
              .where(
                and(
                  eq(studentDiscounts.assessmentId, payment.assessmentId),
                  eq(studentDiscounts.cascadeTriggeredByDiscountId, cashDiscount.id)
                )
              );

            // Reverse cascade adjustments
            for (const adj of cascadeAdjustments) {
              const adjAmount = Number(adj.cascadeAdjustmentAmount ?? 0);
              totalCascadeReversalAmount += adjAmount;

              // Find and delete cascade adjustment assessment items
              // Only search if we have an assessmentItemId to look for
              const cascadeItems = adj.assessmentItemId
                ? await tx
                    .select({ id: assessmentItems.id })
                    .from(assessmentItems)
                    .where(
                      and(
                        eq(assessmentItems.assessmentId, payment.assessmentId),
                        eq(assessmentItems.isCascadeAdjustment, true),
                        eq(assessmentItems.adjustsItemId, adj.assessmentItemId)
                      )
                    )
                : [];

              // Delete cascade adjustment items (soft delete not applicable - these are system items)
              for (const item of cascadeItems) {
                await tx
                  .delete(assessmentItems)
                  .where(eq(assessmentItems.id, item.id));
              }

              // Clear cascade tracking on the affected discount
              await tx
                .update(studentDiscounts)
                .set({
                  cascadeAdjustmentAmount: null,
                  cascadeTriggeredByDiscountId: null,
                })
                .where(eq(studentDiscounts.id, adj.studentDiscountId));

              // Audit cascade reversal
              await logAudit({
                actor: session.userId,
                actorRole: session.role,
                action: "cascade_discount_reversal",
                targetEntity: "student_discounts",
                targetId: adj.studentDiscountId,
                context: `Cascade adjustment reversed due to payment void`,
                previousState: {
                  cascadeAdjustmentAmount: adjAmount,
                  cascadeTriggeredByDiscountId: cashDiscount.id,
                },
              });
            }

            // Reverse cascade adjustment impact on assessment balance
            if (totalCascadeReversalAmount > 0) {
              await reverseCascadeAdjustment(
                tx,
                payment.assessmentId,
                totalCascadeReversalAmount,
                session.userId
              );
            }

            // Reverse the cash discount itself
            await tx
              .update(studentDiscounts)
              .set({
                reversedAt: new Date(),
                reversedBy: session.userId,
                reversalRemarks: `Reversed due to payment void: ${voidReason}`,
              })
              .where(eq(studentDiscounts.id, cashDiscount.id));

            // Delete cash discount assessment item
            if (cashDiscount.assessmentItemId) {
              await tx
                .delete(assessmentItems)
                .where(eq(assessmentItems.id, cashDiscount.assessmentItemId));
            }

            // Reverse cash discount impact on assessment
            await recalcAssessmentTotalsForDiscount(
              tx,
              payment.assessmentId,
              Number(cashDiscount.discountAmount),
              "reverse",
              session.userId
            );

            // Also reverse the related discount request
            await tx
              .update(discountRequests)
              .set({
                status: "reversed",
                reversedAt: new Date(),
                reversedBy: session.userId,
              })
              .where(
                and(
                  eq(discountRequests.assessmentId, payment.assessmentId),
                  eq(discountRequests.discountTypeId, (
                    await tx
                      .select({ id: discountTypes.id })
                      .from(discountTypes)
                      .where(eq(discountTypes.code, FULL_PAYMENT_DISCOUNT_CODE))
                      .limit(1)
                  )[0]?.id ?? ""),
                  eq(discountRequests.status, "approved")
                )
              );

            // Audit cash discount reversal
            await logAudit({
              actor: session.userId,
              actorRole: session.role,
              action: "cash_discount_reversed",
              targetEntity: "student_discounts",
              targetId: cashDiscount.id,
              context: `Cash discount reversed due to payment void`,
              previousState: {
                discountAmount: Number(cashDiscount.discountAmount),
                cascadeAdjustmentsReversed: cascadeAdjustments.length,
                totalCascadeReversal: totalCascadeReversalAmount,
              },
            });
          }

          // Apply negative delta (reversal) for the payment amount
          const { newTotalPaid } = await applyAssessmentBalanceDelta(
            tx,
            payment.assessmentId,
            -pAmount, // negative = reversal
            assessment.cancelledAt,
            assessment.transferredAt,
            session.userId
          );

          // 3b. Revert enrollment status to "assessed" if total paid becomes zero
          if (
            newTotalPaid <= ASSESSMENT_BALANCE_FULLY_PAID_EPSILON &&
            assessment.enrollmentId
          ) {
            await revertToAssessedOnVoid(
              {
                tx,
                enrollmentId: assessment.enrollmentId,
                userId: session.userId,
                userRole: session.role,
              },
              `Total paid reverted to zero after voiding payment`
            );
          }
        }
      }

      // 4. Audit Log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "payment_voided",
        targetEntity: "payments",
        targetId: paymentId,
        context: `Reason: ${voidReason}`,
      }, { throwOnFail: true });
    });

    const link = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      columns: { assessmentId: true },
    });
    if (link?.assessmentId) {
      revalidatePath(`/staff/assessments/${link.assessmentId}`);
    }
    revalidatePath("/staff/assessments");
    // Dashboard KPIs reflect voided collection totals.
    invalidateTag(CACHE_TAGS.DASHBOARD);
    // Enrollment status may have reverted to "assessed" if all payments were
    // voided — SWR is enough; the actor stays on the payments/assessment views,
    // not the enrollment queue, so don't block the response on a re-query.
    invalidateTag(CACHE_TAGS.ENROLLMENTS);

    return { success: true, message: "Payment voided successfully." };
  } catch (error: unknown) {
    // Handle archived student error
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    logger.error("[cashier] Failed to void payment", { error: String(error) });
    const message = error instanceof Error ? error.message : String(error);
    return { message: message || "An unexpected error occurred. Please try again." };
  }
}

// ─── Expired Cash Discount Reversal ──────────────────────────────────────────

/**
 * Reverse an expired cash discount and recalculate cascade adjustments.
 *
 * This action handles the case where:
 * 1. Cash discount was applied via approval workflow
 * 2. Student didn't pay by the cutoff date
 * 3. The discount expired and needs to be reversed
 *
 * The reversal:
 * 1. Marks the cash discount as reversed
 * 2. Reverses any cascade adjustment items created by the cash discount
 * 3. Clears cascade tracking on affected sibling/scholarship discounts
 * 4. Recalculates assessment totals to reflect the original balance
 *
 * @param _prevState - Previous form state (unused)
 * @param formData - Form data containing assessmentId and studentDiscountId
 * @returns CascadeFixFormState with success/error status
 */
export async function reverseExpiredCashDiscountAction(
  _prevState: CascadeFixFormState,
  formData: FormData
): Promise<CascadeFixFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "payments:post")) {
    return { message: "You do not have permission to reverse discounts." };
  }

  const assessmentId = formData.get("assessmentId") as string;
  const studentDiscountId = formData.get("studentDiscountId") as string;

  if (!assessmentId || !studentDiscountId) {
    return { message: "Assessment ID and discount ID are required." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Lock and fetch the cash discount
      const [cashDiscount] = await tx
        .select({
          id: studentDiscounts.id,
          assessmentId: studentDiscounts.assessmentId,
          discountTypeCode: studentDiscounts.discountTypeCode,
          discountAmount: studentDiscounts.discountAmount,
          baseAmount: studentDiscounts.baseAmount,
          assessmentItemId: studentDiscounts.assessmentItemId,
          reversedAt: studentDiscounts.reversedAt,
        })
        .from(studentDiscounts)
        .where(eq(studentDiscounts.id, studentDiscountId))
        .for("update")
        .limit(1);

      if (!cashDiscount) {
        return { message: "Cash discount not found." };
      }

      // 2. Verify it's a cash discount and not already reversed
      if (cashDiscount.discountTypeCode !== FULL_PAYMENT_DISCOUNT_CODE) {
        return { message: "This is not a cash discount." };
      }

      if (cashDiscount.reversedAt) {
        return { message: "This discount has already been reversed." };
      }

      if (cashDiscount.assessmentId !== assessmentId) {
        return { message: "Discount does not belong to this assessment." };
      }

      // 3. Verify the discount is expired (past cutoff date, no payment)
      const [assessmentInfo] = await tx
        .select({
          totalPaid: assessments.totalPaid,
          schoolYearId: assessments.schoolYearId,
        })
        .from(assessments)
        .where(eq(assessments.id, assessmentId))
        .limit(1);

      if (!assessmentInfo) {
        return { message: "Assessment not found." };
      }

      const [schoolYearInfo] = await tx
        .select({
          cashDiscountCutoffDate: schoolYears.cashDiscountCutoffDate,
        })
        .from(schoolYears)
        .where(eq(schoolYears.id, assessmentInfo.schoolYearId))
        .limit(1);

      const hasPaid = Number(assessmentInfo.totalPaid) > 0;
      const cutoffDate = schoolYearInfo?.cashDiscountCutoffDate;

      // Only allow reversal if expired: past cutoff AND no payment made
      if (hasPaid) {
        return {
          message: "Cannot reverse: payment has already been made on this assessment.",
        };
      }

      if (cutoffDate) {
        const now = new Date();
        const cutoffEndOfDay = new Date(cutoffDate);
        cutoffEndOfDay.setHours(23, 59, 59, 999);
        if (now <= cutoffEndOfDay) {
          return {
            message: "Cannot reverse: the cash discount has not yet expired. Wait until after the cutoff date.",
          };
        }
      }

      const cashDiscountAmount = Number(cashDiscount.discountAmount);
      const originalTuitionBase = Number(cashDiscount.baseAmount); // Original tuition before cash discount
      const discountedTuitionBase = originalTuitionBase - cashDiscountAmount; // Discounted tuition
      let totalCascadeReversalAmount = 0;
      let totalDiscountIncrease = 0; // Track increase in discount amounts after recalculation

      // 4. Find ALL tuition_only discounts that were calculated on the DISCOUNTED tuition base
      // This includes:
      // - Discounts that were cascade-adjusted (have cascadeTriggeredByDiscountId set)
      // - Discounts that were ADDED AFTER the cash discount (used discounted base correctly at time of creation)
      // We need to recalculate ALL of them on the ORIGINAL tuition base
      const EPSILON = 0.01;
      const allTuitionDiscounts = await tx
        .select({
          id: studentDiscounts.id,
          discountTypeCode: studentDiscounts.discountTypeCode,
          discountTypeName: studentDiscounts.discountTypeName,
          discountValue: studentDiscounts.discountValue,
          calculationType: studentDiscounts.calculationType,
          baseType: studentDiscounts.baseType,
          baseAmount: studentDiscounts.baseAmount,
          discountAmount: studentDiscounts.discountAmount,
          cascadeAdjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
          assessmentItemId: studentDiscounts.assessmentItemId,
        })
        .from(studentDiscounts)
        .where(
          and(
            eq(studentDiscounts.assessmentId, assessmentId),
            eq(studentDiscounts.baseType, "tuition_only"),
            isNull(studentDiscounts.reversedAt),
            // Exclude the cash discount itself
            ne(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE)
          )
        );

      // Filter to only discounts that used the DISCOUNTED tuition base (not original)
      const discountsToRecalculate = allTuitionDiscounts.filter((d) => {
        const baseAmount = Number(d.baseAmount);
        // Check if base matches the discounted tuition (not original)
        return Math.abs(baseAmount - discountedTuitionBase) < EPSILON;
      });

      // 5. Find and delete cascade adjustment assessment items
      const cascadeAdjustmentItems = await tx
        .select({
          id: assessmentItems.id,
          amount: assessmentItems.amount,
        })
        .from(assessmentItems)
        .where(
          and(
            eq(assessmentItems.assessmentId, assessmentId),
            eq(assessmentItems.isCascadeAdjustment, true)
          )
        );

      // Delete cascade adjustment items
      for (const item of cascadeAdjustmentItems) {
        totalCascadeReversalAmount += Number(item.amount);
        await tx
          .delete(assessmentItems)
          .where(eq(assessmentItems.id, item.id));
      }

      // 6. Recalculate affected discounts on the ORIGINAL tuition base
      // Since these were calculated on the discounted tuition, we need to:
      // - Update the baseAmount to the original tuition
      // - Recalculate the discountAmount
      // - Update the assessment item
      for (const discount of discountsToRecalculate) {
        const oldDiscountAmount = Number(discount.discountAmount);
        const discountValue = Number(discount.discountValue);

        // Calculate new discount on original tuition base
        let newDiscountAmount: number;
        if (discount.calculationType === "percentage") {
          newDiscountAmount = originalTuitionBase * (discountValue / 100);
        } else {
          // Fixed amount - capped at base
          newDiscountAmount = Math.min(discountValue, originalTuitionBase);
        }

        // Round to 2 decimal places
        newDiscountAmount = Math.round(newDiscountAmount * 100) / 100;
        const discountIncrease = newDiscountAmount - oldDiscountAmount;
        totalDiscountIncrease += discountIncrease;

        // Update student discount record
        await tx
          .update(studentDiscounts)
          .set({
            baseAmount: String(originalTuitionBase),
            discountAmount: String(newDiscountAmount),
            cascadeAdjustmentAmount: null,
            cascadeTriggeredByDiscountId: null,
          })
          .where(eq(studentDiscounts.id, discount.id));

        // Update the assessment item description and amount
        if (discount.assessmentItemId) {
          const baseLabel = discount.baseType === "tuition_only" ? "tuition" : "full assessment";
          const formattedBase = `₱${originalTuitionBase.toLocaleString("en-PH")}`.replace(/\.00$/, "");
          const newDescription = `${discount.discountTypeName} (on ${formattedBase} ${baseLabel})`;

          await tx
            .update(assessmentItems)
            .set({
              description: newDescription,
              amount: String(newDiscountAmount),
              updatedBy: session.userId,
              updatedAt: new Date(),
            })
            .where(eq(assessmentItems.id, discount.assessmentItemId));
        }

        // Audit the recalculation
        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "discount_recalculated_on_reversal",
          targetEntity: "student_discounts",
          targetId: discount.id,
          context: `Discount recalculated on original tuition after cash discount reversal`,
          previousState: {
            baseAmount: Number(discount.baseAmount),
            discountAmount: oldDiscountAmount,
            cascadeAdjustmentAmount: Number(discount.cascadeAdjustmentAmount ?? 0),
          },
          newState: {
            baseAmount: originalTuitionBase,
            discountAmount: newDiscountAmount,
            increase: discountIncrease,
          },
        });
      }

      // 7. Mark cash discount as reversed AND clear the assessmentItemId reference
      // (must clear reference before deleting the item due to FK constraint)
      await tx
        .update(studentDiscounts)
        .set({
          reversedAt: new Date(),
          reversedBy: session.userId,
          reversalRemarks: "Expired - past cutoff date, no payment received",
          assessmentItemId: null,
        })
        .where(eq(studentDiscounts.id, studentDiscountId));

      // 8. Delete cash discount assessment item (after FK reference is cleared)
      if (cashDiscount.assessmentItemId) {
        await tx
          .delete(assessmentItems)
          .where(eq(assessmentItems.id, cashDiscount.assessmentItemId));
      }

      // 9. Reverse the cash discount impact on assessment totals
      // This increases totalAmount and balance back to the original
      await recalcAssessmentTotalsForDiscount(
        tx,
        assessmentId,
        cashDiscountAmount,
        "reverse",
        session.userId
      );

      // 10. Reverse cascade adjustment impact on assessment totals
      // Cascade adjustments ADDED to balance, so reversing them DECREASES balance
      if (totalCascadeReversalAmount > 0) {
        await reverseCascadeAdjustment(
          tx,
          assessmentId,
          totalCascadeReversalAmount,
          session.userId
        );
      }

      // 10b. Apply the increased discount amounts to assessment totals
      // When we recalculated discounts on the original tuition, they increased
      // (e.g., sibling discount went from ₱1,710 to ₱1,900 = +₱190 more discount)
      // This needs to DECREASE the totalAmount and balance
      if (totalDiscountIncrease > 0) {
        await recalcAssessmentTotalsForDiscount(
          tx,
          assessmentId,
          totalDiscountIncrease,
          "apply", // Apply additional discount
          session.userId
        );
      }

      // 11. Also reverse the related discount request
      await tx
        .update(discountRequests)
        .set({
          status: "reversed",
          reversedAt: new Date(),
          reversedBy: session.userId,
        })
        .where(
          and(
            eq(discountRequests.assessmentId, assessmentId),
            eq(
              discountRequests.discountTypeId,
              (
                await tx
                  .select({ id: discountTypes.id })
                  .from(discountTypes)
                  .where(eq(discountTypes.code, FULL_PAYMENT_DISCOUNT_CODE))
                  .limit(1)
              )[0]?.id ?? ""
            ),
            eq(discountRequests.status, "approved")
          )
        );

      // 12. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "expired_cash_discount_reversed",
        targetEntity: "student_discounts",
        targetId: studentDiscountId,
        context: `Expired cash discount reversed, affected discounts recalculated on original tuition`,
        previousState: {
          discountAmount: cashDiscountAmount,
          discountsRecalculated: discountsToRecalculate.length,
          totalCascadeReversal: totalCascadeReversalAmount,
          totalDiscountIncrease,
        },
      });

      // 13. Invalidate caches
      revalidatePath("/staff/payments");
      revalidatePath(`/staff/payments/process/${assessmentId}`);
      invalidateTag(CACHE_TAGS.DASHBOARD);

      return {
        success: true,
        message: `Expired discount reversed. Balance increased by ₱${cashDiscountAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
        totalAdjustment: cashDiscountAmount,
      };
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    logger.error("[payments] Expired cash discount reversal failed", {
      error: String(error),
      assessmentId,
      studentDiscountId,
    });
    return { message };
  }
}

// ─── Cascade Fix ─────────────────────────────────────────────────────────────

/**
 * Apply cascade fix for discounts that were applied out-of-order.
 *
 * This action corrects the case where:
 * 1. Cash discount was applied first (via approval workflow)
 * 2. Sibling/scholarship discounts were applied later
 * 3. Those later discounts used the ORIGINAL tuition base instead of
 *    the DISCOUNTED tuition base
 *
 * The fix creates positive adjustment items that reduce the effective
 * discount amount, bringing the balance back to the correct value.
 *
 * @param _prevState - Previous form state (unused)
 * @param formData - Form data containing assessmentId
 * @returns CascadeFixFormState with success/error status
 */
export async function applyCascadeFixAction(
  _prevState: CascadeFixFormState,
  formData: FormData
): Promise<CascadeFixFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "payments:post")) {
    return { message: "You do not have permission to apply cascade fixes." };
  }

  const assessmentId = formData.get("assessmentId") as string;
  if (!assessmentId) {
    return { message: "Assessment ID is required." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Re-check cascade fix needed (inside transaction for consistency)
      const fixData = await checkCascadeFixNeeded(assessmentId);
      if (!fixData) {
        return { message: "No cascade fix needed for this assessment." };
      }

      let totalAdjustmentApplied = 0;

      // 2. For each misaligned discount, create cascade adjustment
      for (const adj of fixData.adjustments) {
        // Create positive assessment item (adds back to balance)
        const adjustmentDescription =
          `Cascade Adjustment: ${adj.discountTypeName} ` +
          `(₱${adj.originalAmount.toFixed(2)} → ₱${adj.correctAmount.toFixed(2)})`;

        const [adjustmentItem] = await tx
          .insert(assessmentItems)
          .values({
            assessmentId,
            description: adjustmentDescription,
            amount: String(adj.adjustmentNeeded),
            isDiscount: false, // Positive = adds to balance
            isRefundable: false,
            isCascadeAdjustment: true,
            adjustsItemId: adj.assessmentItemId,
            createdBy: session.userId,
            updatedBy: session.userId,
          })
          .returning({ id: assessmentItems.id });

        // Update student discount with cascade tracking
        await tx
          .update(studentDiscounts)
          .set({
            cascadeAdjustmentAmount: String(adj.adjustmentNeeded),
            cascadeTriggeredByDiscountId: fixData.cashDiscountId,
          })
          .where(eq(studentDiscounts.id, adj.studentDiscountId));

        // Audit log
        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "cascade_discount_fix",
          targetEntity: "student_discounts",
          targetId: adj.studentDiscountId,
          context: assessmentId,
          newState: {
            adjustmentItemId: adjustmentItem.id,
            originalAmount: adj.originalAmount,
            correctAmount: adj.correctAmount,
            adjustmentApplied: adj.adjustmentNeeded,
            triggeredByCashDiscountId: fixData.cashDiscountId,
          },
        });

        totalAdjustmentApplied += adj.adjustmentNeeded;
      }

      // 3. Update assessment totals
      await recalcAssessmentTotalsForCascade(
        tx,
        assessmentId,
        totalAdjustmentApplied,
        session.userId
      );

      // 4. Invalidate caches (non-blocking)
      revalidatePath("/staff/payments");
      revalidatePath(`/staff/payments/process/${assessmentId}`);
      invalidateTag(CACHE_TAGS.DASHBOARD);

      return {
        success: true,
        message: `Cascade fix applied. Balance increased by ₱${totalAdjustmentApplied.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
        totalAdjustment: totalAdjustmentApplied,
      };
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    logger.error("[payments] Cascade fix failed", { error: String(error), assessmentId });
    return { message };
  }
}
