"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  enrollments,
  assessments,
  assessmentItems,
  gradeLevels,
  schoolYears,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, and, ne, isNotNull, desc } from "drizzle-orm";
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

  // ─── Check for Balance Forward (Old Students) ────────────────────────────
  let balanceForwardItem: {
    description: string;
    amount: string;
    previousAssessmentId: string;
  } | null = null;

  if (enrollmentRow.studentType === "old_student") {
    // Find most recent previous enrollment with assessment
    const [priorEnrollment] = await db
      .select({
        assessmentId: assessments.id,
        balance: assessments.balance,
        schoolYearLabel: schoolYears.label,
      })
      .from(enrollments)
      .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
      .leftJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.studentId, enrollmentRow.studentId),
          ne(enrollments.schoolYearId, enrollmentRow.schoolYearId), // Different year
          eq(enrollments.status, "enrolled"), // Only fully enrolled
          isNotNull(assessments.id) // Has assessment
        )
      )
      .orderBy(desc(schoolYears.startDate))
      .limit(1);

    if (priorEnrollment && priorEnrollment.balance && priorEnrollment.assessmentId) {
      const balanceAmount = Number(priorEnrollment.balance);
      if (balanceAmount > 0.01) { // Skip zero and negative (credits)
        balanceForwardItem = {
          description: `Balance Forward from ${priorEnrollment.schoolYearLabel}`,
          amount: priorEnrollment.balance,
          previousAssessmentId: priorEnrollment.assessmentId,
        };
      }
    }
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
  const submittedById = new Map(items.map((row) => [row.feeTemplateItemId, row.amount]));
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
    feeTemplateItemId: string | null; // Allow null for balance forward items
    feeItemTypeId: string;
  }[] = [];
  for (const line of items) {
    const template = templateMap.get(line.feeTemplateItemId)!;
    resolvedLines.push({
      feeTemplateItemId: template.feeTemplateItemId,
      feeItemTypeId: template.feeItemTypeId,
      description: template.description,
      amount: line.amount,
      isDiscount: template.isDiscount,
    });
  }

  // ─── Add Balance Forward Item (if applicable) ────────────────────────────
  if (balanceForwardItem) {
    // Get BALANCE_FORWARD fee item type (must exist in seed data)
    const balanceForwardType = await db.query.feeItemTypes.findFirst({
      where: eq(feeItemTypes.code, "BALANCE_FORWARD"),
      columns: { id: true },
    });

    if (!balanceForwardType) {
      return {
        message:
          "Balance Forward fee type not found in system. Run: npx tsx scripts/seed-fee-item-types.ts",
      };
    }

    // Prepend balance forward to beginning (will show first in list)
    resolvedLines.unshift({
      feeTemplateItemId: null, // Not from template
      feeItemTypeId: balanceForwardType.id,
      description: balanceForwardItem.description,
      amount: Number(balanceForwardItem.amount),
      isDiscount: false,
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
          feeTemplateItemId: item.feeTemplateItemId ?? null, // Allow null for balance forward
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
          hasBalanceForward: !!balanceForwardItem,
          balanceForwardAmount: balanceForwardItem?.amount ?? null,
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
