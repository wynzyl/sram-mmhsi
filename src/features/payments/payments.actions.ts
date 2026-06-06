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
} from "@/lib/db/schema";
import { eq, and, lte, gte, ne } from "drizzle-orm";
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
import { formatStoredOrNumber } from "@/lib/utils/or-number";
import { assertEnrollmentAllowsPayment } from "@/lib/utils/enrollment-payment";
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
import { applyAssessmentBalanceDelta } from "@/lib/utils/assessment-balance";
import { assertNoPendingCancellation } from "@/features/enrollments/enrollment-cancellation.queries";

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

  const { startNumber, endNumber } = parsed.data;
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
      },
    }, { throwOnFail: true });

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

  const { studentId, assessmentId, bookletId, amount, paymentMethod, referenceNumber, remarks, idempotencyKey } =
    result.data;

  try {
    let orNumberToAssign: string | undefined;
    let bookletIdToAssign: string | undefined;
    let idempotentReplay = false;

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

      // 2. Fetch Selected Active Booklet (locking it for update to prevent race conditions on OR number)
      const activeBooklet = await lockReceiptBooklet(tx, bookletId, "active");

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
        .where(eq(receiptBooklets.id, bookletIdToAssign as string));

      // 4. Create Payment Record
      const [newPayment] = await tx
        .insert(payments)
        .values({
          studentId,
          assessmentId,
          bookletId: bookletIdToAssign,
          orNumber: orNumberToAssign,
          orStatus: "consumed",
          amount: String(amount),
          paymentMethod,
          referenceNumber,
          paymentDate: new Date(),
          status: "posted",
          remarks,
          idempotencyKey,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: payments.id });

      // 5. Update Assessment Balance
      const { newBalance } = await applyAssessmentBalanceDelta(
        tx,
        assessmentId,
        amount, // positive = payment
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
        context: `OR: ${orNumberToAssign}`,
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
    // Dashboard KPIs reflect collections; an enrollment can flip to "enrolled" via payment.
    invalidateTag(CACHE_TAGS.DASHBOARD);
    // SWR is enough here: the cashier lands on /staff/payments next, which does
    // not render the enrollment-queue counts. A blocking updateTag() would force
    // getEnrollmentQueueCounts() to re-run inside this action response (slow
    // "Posting…" spinner) for data the actor never sees.
    invalidateTag(CACHE_TAGS.ENROLLMENTS);
    return { success: true, message: `Payment posted successfully. OR Number: ${orNumberToAssign}` };
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

          // Apply negative delta (reversal)
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
  } catch (error: any) {
    logger.error("[cashier] Failed to void payment", { error: String(error) });
    return { message: error.message || "An unexpected error occurred. Please try again." };
  }
}
