"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  enrollments,
  assessments,
  assessmentItems,
  auditLogs,
  feeSchedules,
  feeScheduleItems,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateAssessmentFromEnrollmentSchema,
  computeAssessmentTotals,
} from "@/lib/validators/assessment";
import type { AssessmentFormState } from "@/lib/validators/assessment";
import { logger } from "@/lib/observability/logger";

export async function createAssessmentFromEnrollmentAction(
  _prevState: AssessmentFormState,
  formData: FormData
): Promise<AssessmentFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "assessments:create")) {
    return { message: "You do not have permission to create assessments." };
  }

  let itemsRaw: unknown;
  try {
    itemsRaw = JSON.parse(String(formData.get("items") ?? "null"));
  } catch {
    return { message: "Invalid line items payload." };
  }

  const parsed = CreateAssessmentFromEnrollmentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    remarks: formData.get("remarks") || undefined,
    items: itemsRaw,
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      errors: flat.fieldErrors as AssessmentFormState["errors"],
      message: flat.formErrors[0],
    };
  }

  const { enrollmentId, remarks, items } = parsed.data;

  const enrollmentRow = await db.query.enrollments.findFirst({
    where: eq(enrollments.id, enrollmentId),
  });

  if (!enrollmentRow) {
    return { message: "Enrollment not found." };
  }

  if (enrollmentRow.status !== "pending") {
    return {
      message: `Assessment can only be created when enrollment is Pending (current: ${enrollmentRow.status}).`,
    };
  }

  const existing = await db.query.assessments.findFirst({
    where: eq(assessments.enrollmentId, enrollmentId),
    columns: { id: true },
  });
  if (existing) {
    return { message: "An assessment already exists for this enrollment." };
  }

  const scheduleRow = await db.query.feeSchedules.findFirst({
    where: eq(feeSchedules.schoolYearId, enrollmentRow.schoolYearId),
    columns: { id: true, isActive: true },
  });

  if (!scheduleRow) {
    return {
      message:
        "No fee schedule exists for this school year. Configure Finance → Fee schedules first.",
    };
  }

  if (!scheduleRow.isActive) {
    return {
      message:
        "The fee schedule for this school year is inactive. Activate it under Finance → Fee schedules.",
    };
  }

  const catalogCountRow = await db
    .select({ n: feeScheduleItems.id })
    .from(feeScheduleItems)
    .where(eq(feeScheduleItems.feeScheduleId, scheduleRow.id))
    .limit(1);

  if (catalogCountRow.length === 0) {
    return {
      message:
        "The fee catalog has no line items yet. Add fee types under Finance → Fee schedules for this school year first.",
    };
  }

  const submittedById = new Map(items.map((row) => [row.feeScheduleItemId, row.amount]));
  if (submittedById.size !== items.length) {
    return { message: "Each catalog fee may only appear once." };
  }

  const submittedIds = [...submittedById.keys()];
  const catalogMatches = await db.query.feeScheduleItems.findMany({
    where: and(
      eq(feeScheduleItems.feeScheduleId, scheduleRow.id),
      inArray(feeScheduleItems.id, submittedIds)
    ),
  });

  if (catalogMatches.length !== submittedIds.length) {
    return {
      message:
        "One or more selected fees are not in the school year catalog. Refresh the page and try again.",
    };
  }

  const catalogMap = new Map(catalogMatches.map((c) => [c.id, c]));
  const resolvedLines: {
    description: string;
    amount: number;
    isDiscount: boolean;
    feeScheduleItemId: string;
  }[] = [];
  for (const line of items) {
    const catalog = catalogMap.get(line.feeScheduleItemId)!;
    resolvedLines.push({
      feeScheduleItemId: catalog.id,
      description: catalog.description,
      amount: line.amount,
      isDiscount: catalog.isDiscount,
    });
  }

  const assessmentTotalAmount = computeAssessmentTotals(resolvedLines);

  if (assessmentTotalAmount <= 0) {
    return { message: "Total assessed amount must be greater than zero." };
  }

  let newAssessmentId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const scheduleCheck = await tx.query.feeSchedules.findFirst({
        where: eq(feeSchedules.schoolYearId, enrollmentRow.schoolYearId),
        columns: { id: true, isActive: true },
      });
      if (!scheduleCheck?.isActive || scheduleCheck.id !== scheduleRow.id) {
        throw new Error("FEE_SCHEDULE_CHANGED");
      }

      const latestMatches = await tx.query.feeScheduleItems.findMany({
        where: and(
          eq(feeScheduleItems.feeScheduleId, scheduleRow.id),
          inArray(feeScheduleItems.id, submittedIds)
        ),
      });
      if (latestMatches.length !== submittedIds.length) {
        throw new Error("FEE_SCHEDULE_CHANGED");
      }

      const [newAssessment] = await tx
        .insert(assessments)
        .values({
          enrollmentId,
          studentId: enrollmentRow.studentId,
          schoolYearId: enrollmentRow.schoolYearId,
          totalAmount: String(assessmentTotalAmount.toFixed(2)),
          totalPaid: "0.00",
          balance: String(assessmentTotalAmount.toFixed(2)),
          remarks: remarks ?? null,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: assessments.id });

      newAssessmentId = newAssessment.id;

      await tx.insert(assessmentItems).values(
        resolvedLines.map((item) => ({
          assessmentId: newAssessment.id,
          feeScheduleItemId: item.feeScheduleItemId,
          description: item.description,
          amount: String(Number(item.amount).toFixed(2)),
          isDiscount: item.isDiscount,
          createdBy: session.userId,
          updatedBy: session.userId,
        }))
      );

      await tx
        .update(enrollments)
        .set({
          status: "assessed",
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(enrollments.id, enrollmentId), eq(enrollments.status, "pending"))
        );

      await tx.insert(auditLogs).values({
        actor: session.userId,
        actorRole: session.role,
        action: "assessment_created_and_enrollment_assessed",
        targetEntity: "assessments",
        targetId: newAssessment.id,
        context: enrollmentId,
        newState: JSON.stringify({
          enrollmentId,
          totalAmount: assessmentTotalAmount,
          lineCount: resolvedLines.length,
          feeScheduleId: scheduleRow.id,
        }),
      });
    });

    logger.info("[assessments] Created assessment from enrollment", {
      enrollmentId,
      assessmentId: newAssessmentId,
      actorId: session.userId,
    });

    revalidatePath("/admin/assessments");
    revalidatePath("/admin/enrollments");
    revalidatePath(`/admin/students/${enrollmentRow.studentId}`);
    if (newAssessmentId) {
      revalidatePath(`/admin/assessments/${newAssessmentId}`);
    }

    return { success: true, assessmentId: newAssessmentId };
  } catch (err) {
    if (String(err).includes("FEE_SCHEDULE_CHANGED")) {
      return {
        message:
          "The fee schedule changed while saving. Refresh this page and submit again.",
      };
    }
    logger.error("[assessments] Failed to create assessment", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
