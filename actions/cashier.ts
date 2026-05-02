"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  receiptBooklets,
  payments,
  assessments,
  enrollments,
  auditLogs,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateBookletSchema,
  PostPaymentSchema,
  VoidPaymentSchema,
} from "@/lib/validators/cashier";
import type {
  BookletFormState,
  PaymentFormState,
  VoidPaymentFormState,
} from "@/lib/validators/cashier";
import { logger } from "@/lib/observability/logger";
import { formatStoredOrNumber } from "@/lib/utils/or-number";
import { assertEnrollmentAllowsPayment } from "@/lib/utils/enrollment-payment";

// ─── Receipt Booklets ────────────────────────────────────────────────────────

export async function createBookletAction(
  _prevState: BookletFormState,
  formData: FormData
): Promise<BookletFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "booklets:manage")) {
    return { message: "You do not have permission to manage OR booklets." };
  }

  const parsed = CreateBookletSchema.safeParse({
    series: formData.get("series"),
    prefix: formData.get("prefix"),
    startNumber: formData.get("startNumber"),
    endNumber: formData.get("endNumber"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as BookletFormState["errors"] };
  }

  const { series, prefix, startNumber, endNumber } = parsed.data;

  const existingSeries = await db.query.receiptBooklets.findFirst({
    where: and(
      eq(receiptBooklets.series, series),
      eq(receiptBooklets.status, "active")
    ),
  });

  if (existingSeries) {
    return {
      errors: {
        _form: [`An active booklet for series '${series}' already exists. Please exhaust or void it first.`],
      },
    };
  }

  const existingPrefix = await db.query.receiptBooklets.findFirst({
    where: and(
      eq(receiptBooklets.prefix, prefix),
      eq(receiptBooklets.status, "active")
    ),
  });

  if (existingPrefix) {
    return {
      errors: {
        _form: [
          `An active booklet with OR prefix '${prefix}' already exists. Use another prefix or exhaust the current booklet first.`,
        ],
      },
    };
  }

  try {
    const [newBooklet] = await db
      .insert(receiptBooklets)
      .values({
        series,
        prefix,
        startNumber,
        endNumber,
        nextNumber: startNumber,
        status: "active",
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: receiptBooklets.id });

    await db.insert(auditLogs).values({
      actor: session.userId,
      actorRole: session.role,
      action: "booklet_created",
      targetEntity: "receipt_booklets",
      targetId: newBooklet.id,
      newState: JSON.stringify(parsed.data),
    });

    revalidatePath("/admin/finance/booklets");
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

  const parsed = PostPaymentSchema.safeParse({
    studentId: formData.get("studentId"),
    assessmentId: formData.get("assessmentId"),
    bookletId: formData.get("bookletId"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    amountTendered: formData.get("amountTendered"),
    referenceNumber: formData.get("referenceNumber") || undefined,
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as PaymentFormState["errors"] };
  }

  const { studentId, assessmentId, bookletId, amount, paymentMethod, referenceNumber, remarks } = parsed.data;

  try {
    let orNumberToAssign: string | undefined;
    let bookletIdToAssign: string | undefined;

    await db.transaction(async (tx) => {
      // 1. Fetch Assessment & Verify Balance
      const assessment = await tx.query.assessments.findFirst({
        where: and(
          eq(assessments.id, assessmentId),
          eq(assessments.studentId, studentId)
        ),
      });

      if (!assessment) throw new Error("Assessment not found.");
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

      // 2. Fetch Selected Active Booklet (locking it for update to prevent race conditions on OR number)
      // Note: Drizzle ORM does not support row-level locking natively in `query` builder yet without raw SQL,
      // but for V1 we do a basic select/update. 
      const activeBookletRows = await tx.execute(
        sql`SELECT * FROM "receipt_booklets" WHERE "id" = ${bookletId} AND "status" = 'active' FOR UPDATE`
      );

      // In postgres driver, execute returns an array directly, not an object with a .rows property.
      if (!Array.isArray(activeBookletRows) || activeBookletRows.length === 0) {
        throw new Error("The selected receipt booklet is either invalid or no longer active. Please refresh and select another.");
      }

      const activeBooklet = activeBookletRows[0] as {
        id: string;
        prefix: string;
        series: string;
        next_number: number;
        end_number: number;
      };
      bookletIdToAssign = activeBooklet.id;
      const currentNext = Number(activeBooklet.next_number);
      const endNum = Number(activeBooklet.end_number);
      const bookletPrefix = String(activeBooklet.prefix ?? "").trim() || String(activeBooklet.series ?? "").trim();

      orNumberToAssign = formatStoredOrNumber(bookletPrefix, currentNext, endNum);

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
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: payments.id });

      // 5. Update Assessment Balance
      const newTotalPaid = Number(assessment.totalPaid) + amount;
      const newBalance = Number(assessment.balance) - amount;

      await tx
        .update(assessments)
        .set({
          totalPaid: String(newTotalPaid),
          balance: String(newBalance),
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(assessments.id, assessmentId));

      // 6. Check and Update Enrollment Status
      if (assessment.enrollmentId) {
        const enrollmentRows = await tx.execute(
          sql`SELECT "status" FROM "enrollments" WHERE "id" = ${assessment.enrollmentId} FOR UPDATE`
        );
        if (Array.isArray(enrollmentRows) && enrollmentRows.length > 0) {
          const enrollment = enrollmentRows[0] as any;
          if (enrollment.status === "assessed") {
            await tx
              .update(enrollments)
              .set({
                status: "enrolled",
                enrolledAt: new Date(),
                updatedBy: session.userId,
                updatedAt: new Date(),
              })
              .where(eq(enrollments.id, assessment.enrollmentId));
            
            await tx.insert(auditLogs).values({
              actor: session.userId,
              actorRole: session.role,
              action: "enrollment_enrolled_via_payment",
              targetEntity: "enrollments",
              targetId: assessment.enrollmentId,
              context: `Payment posted: OR ${orNumberToAssign}`,
            });
          }
        }
      }

      // 7. Audit Log
      await tx.insert(auditLogs).values({
        actor: session.userId,
        actorRole: session.role,
        action: "payment_posted",
        targetEntity: "payments",
        targetId: newPayment.id,
        context: `OR: ${orNumberToAssign}`,
      });
    });

    revalidatePath(`/admin/assessments/${assessmentId}`);
    return { success: true, message: `Payment posted successfully. OR Number: ${orNumberToAssign}` };
  } catch (error: any) {
    logger.error("[cashier] Failed to post payment", { error: String(error) });
    return { message: error.message || "An unexpected error occurred. Please try again." };
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

  const parsed = VoidPaymentSchema.safeParse({
    paymentId: formData.get("paymentId"),
    voidReason: formData.get("voidReason"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as VoidPaymentFormState["errors"] };
  }

  const { paymentId, voidReason } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch Payment (FOR UPDATE to prevent concurrent voiding)
      const paymentRows = await tx.execute(
        sql`SELECT * FROM "payments" WHERE "id" = ${paymentId} FOR UPDATE`
      );

      if (!Array.isArray(paymentRows) || paymentRows.length === 0) {
        throw new Error("Payment not found.");
      }

      const payment = paymentRows[0] as any;

      if (payment.status === "voided") {
        throw new Error("Payment is already voided.");
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
      if (payment.assessment_id) {
        const assessmentRows = await tx.execute(
          sql`SELECT * FROM "assessments" WHERE "id" = ${payment.assessment_id} FOR UPDATE`
        );
        if (Array.isArray(assessmentRows) && assessmentRows.length > 0) {
          const assessment = assessmentRows[0] as any;
          const pAmount = Number(payment.amount);
          
          const newTotalPaid = Number(assessment.total_paid) - pAmount;
          const newBalance = Number(assessment.balance) + pAmount;

          await tx
            .update(assessments)
            .set({
              totalPaid: String(newTotalPaid),
              balance: String(newBalance),
              updatedBy: session.userId,
              updatedAt: new Date(),
            })
            .where(eq(assessments.id, payment.assessment_id));
        }
      }

      // 4. Audit Log
      await tx.insert(auditLogs).values({
        actor: session.userId,
        actorRole: session.role,
        action: "payment_voided",
        targetEntity: "payments",
        targetId: paymentId,
        context: `Reason: ${voidReason}`,
      });
    });

    // Revalidate paths. To know the assessmentId properly, we should fetch it before.
    // It is handled inside the try block, but we can't easily revalidate outside unless we extract it.
    // We'll just do a general revalidate for now or return success. 
    return { success: true, message: "Payment voided successfully." };
  } catch (error: any) {
    logger.error("[cashier] Failed to void payment", { error: String(error) });
    return { message: error.message || "An unexpected error occurred. Please try again." };
  }
}
