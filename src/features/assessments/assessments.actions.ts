"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  enrollments,
  assessments,
  assessmentItems,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveFeeScheduleForAssessment } from "@/lib/fee-schedule/resolve";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateAssessmentFromEnrollmentSchema,
  computeAssessmentTotals,
} from "./assessments.schema";
import type { AssessmentFormState } from "./assessments.schema";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";

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

  const gradeRow = await db.query.gradeLevels.findFirst({
    where: eq(gradeLevels.id, enrollmentRow.gradeLevelId),
    columns: { assessmentBand: true },
  });
  if (!gradeRow) {
    return { message: "Grade level not found for this enrollment." };
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

  const scheduleResolution = await resolveFeeScheduleForAssessment(db, {
    schoolYearId: enrollmentRow.schoolYearId,
    assessmentBand: gradeRow.assessmentBand,
  });

  if (!scheduleResolution) {
    return {
      message:
        "No fee schedule exists for this school year and grade band. Configure Finance → Fee Templates first.",
    };
  }

  if (scheduleResolution.items.length === 0) {
    return {
      message:
        "The fee template has no line items yet. Add fee types to the template under Finance → Fee Templates.",
    };
  }

  // Validate submitted items against resolved template items
  const submittedById = new Map(items.map((row) => [row.feeScheduleItemId, row.amount]));
  if (submittedById.size !== items.length) {
    return { message: "Each catalog fee may only appear once." };
  }

  const submittedIds = [...submittedById.keys()];
  const templateItemIds = new Set(scheduleResolution.items.map(i => i.feeTemplateItemId));

  // Check if all submitted items exist in the resolved template
  const invalidIds = submittedIds.filter(id => !templateItemIds.has(id));
  if (invalidIds.length > 0) {
    return {
      message:
        "One or more selected fees are not in the current fee template. Refresh the page and try again.",
    };
  }

  // Build resolved lines using template data + submitted amounts
  const templateMap = new Map(scheduleResolution.items.map((item) => [item.feeTemplateItemId, item]));
  const resolvedLines: {
    description: string;
    amount: number;
    isDiscount: boolean;
    feeTemplateItemId: string;
    feeItemTypeId: string;
  }[] = [];
  for (const line of items) {
    const template = templateMap.get(line.feeScheduleItemId)!;
    resolvedLines.push({
      feeTemplateItemId: template.feeTemplateItemId,
      feeItemTypeId: template.feeItemTypeId,
      description: template.description,
      amount: line.amount,
      isDiscount: template.isDiscount,
    });
  }

  const assessmentTotalAmount = computeAssessmentTotals(resolvedLines);

  if (assessmentTotalAmount <= 0) {
    return { message: "Total assessed amount must be greater than zero." };
  }

  let newAssessmentId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const scheduleCheck = await resolveFeeScheduleForAssessment(tx, {
        schoolYearId: enrollmentRow.schoolYearId,
        assessmentBand: gradeRow.assessmentBand,
      });
      if (!scheduleCheck || scheduleCheck.scheduleId !== scheduleResolution.scheduleId) {
        throw new Error("FEE_SCHEDULE_CHANGED");
      }

      // Verify template items haven't changed
      const currentTemplateItemIds = new Set(scheduleCheck.items.map(i => i.feeTemplateItemId));
      const originalTemplateItemIds = new Set(submittedIds);

      if (currentTemplateItemIds.size !== originalTemplateItemIds.size ||
          ![...originalTemplateItemIds].every(id => currentTemplateItemIds.has(id))) {
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
          feeTemplateItemId: item.feeTemplateItemId, // ← New: For audit trail
          feeItemTypeId: item.feeItemTypeId,          // ← New: For reporting
          description: item.description,               // ← Snapshot from fee_item_types.name
          amount: String(Number(item.amount).toFixed(2)),
          isDiscount: item.isDiscount,                 // ← Snapshot from fee_item_types.isDiscount
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

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "assessment_created_and_enrollment_assessed",
        targetEntity: "assessments",
        targetId: newAssessment.id,
        context: enrollmentId,
        newState: {
          enrollmentId,
          totalAmount: assessmentTotalAmount,
          lineCount: resolvedLines.length,
          feeScheduleId: scheduleResolution.scheduleId,
        },
      }, { throwOnFail: true });
    });

    logger.info("[assessments] Created assessment from enrollment", {
      enrollmentId,
      assessmentId: newAssessmentId,
      actorId: session.userId,
    });

    revalidatePath("/staff/assessments");
    revalidatePath("/staff/enrollments");
    revalidatePath(`/staff/students/${enrollmentRow.studentId}`);
    if (newAssessmentId) {
      revalidatePath(`/staff/assessments/${newAssessmentId}`);
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
