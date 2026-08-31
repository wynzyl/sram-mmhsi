"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { studentClearances, assessments, enrollments, students } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { logger } from "@/lib/observability/logger";
import {
  GenerateClearanceSchema,
  ResolveClearanceSchema,
  BatchGenerateEOYClearancesSchema,
  CLEARANCE_TYPE_LABELS,
  RESOLUTION_TYPE_LABELS,
  type ClearanceType,
  type ResolutionType,
} from "./clearances.schema";
import type {
  GenerateClearanceFormState,
  ResolveClearanceFormState,
  BatchGenerateEOYClearancesFormState,
} from "./clearances.schema";
import {
  getClearanceForValidation,
  clearanceExistsForEnrollment,
} from "./clearances.queries";

// ─── Generate Clearance Action ────────────────────────────────────────────────

/**
 * Manually generate a clearance record for a student.
 */
export async function generateClearanceAction(
  _prevState: GenerateClearanceFormState,
  formData: FormData
): Promise<GenerateClearanceFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "clearances:create")) {
    return { message: "You do not have permission to generate clearances." };
  }

  const result = parseFormData(GenerateClearanceSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { studentId, enrollmentId, schoolYearId, clearanceType } = result.data;

  try {
    let clearanceId: string | undefined;
    let outstandingAmount = "0";

    await db.transaction(async (tx) => {
      // 1. Check if clearance already exists (if enrollment provided)
      if (enrollmentId) {
        const exists = await clearanceExistsForEnrollment(
          enrollmentId,
          clearanceType as ClearanceType
        );
        if (exists) {
          throw new Error(
            `A ${CLEARANCE_TYPE_LABELS[clearanceType as ClearanceType]} clearance already exists for this enrollment.`
          );
        }

        // Get assessment balance
        const [assessment] = await tx
          .select({
            balance: assessments.balance,
            schoolYearId: assessments.schoolYearId,
          })
          .from(assessments)
          .where(
            and(eq(assessments.enrollmentId, enrollmentId), isNull(assessments.cancelledAt))
          )
          .limit(1);

        if (assessment) {
          outstandingAmount = assessment.balance;
        }
      }

      // 2. Determine status based on balance
      const balance = Number(outstandingAmount);
      const status = balance <= 0 ? "cleared" : "pending";

      // 3. Create clearance record
      const [newClearance] = await tx
        .insert(studentClearances)
        .values({
          studentId,
          enrollmentId: enrollmentId ?? null,
          schoolYearId: schoolYearId ?? null,
          clearanceType: clearanceType as ClearanceType,
          outstandingAmount,
          status,
          createdBy: session.userId,
        })
        .returning({ id: studentClearances.id });

      clearanceId = newClearance.id;

      // 4. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "clearance_generated",
        targetEntity: "student_clearances",
        targetId: newClearance.id,
        newState: {
          studentId,
          enrollmentId,
          clearanceType,
          clearanceTypeLabel: CLEARANCE_TYPE_LABELS[clearanceType as ClearanceType],
          outstandingAmount,
          status,
        },
      }, { throwOnFail: true });
    });

    logger.info("[clearances] Clearance generated", {
      clearanceId,
      studentId,
      actorId: session.userId,
    });

    // Get student reference number for revalidation path
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
      columns: { referenceNumber: true },
    });

    revalidatePath("/staff/approvals");
    if (student) {
      revalidatePath(`/staff/students/${student.referenceNumber}/clearances`);
    }

    return {
      success: true,
      message: "Clearance record created successfully.",
      clearanceId,
    };
  } catch (error: unknown) {
    logger.error("[clearances] Failed to generate clearance", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Resolve Clearance Action ─────────────────────────────────────────────────

/**
 * Resolve a pending clearance (paid, waived, or written off).
 */
export async function resolveClearanceAction(
  _prevState: ResolveClearanceFormState,
  formData: FormData
): Promise<ResolveClearanceFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "clearances:resolve")) {
    return { message: "You do not have permission to resolve clearances." };
  }

  const result = parseFormData(ResolveClearanceSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { clearanceId, resolutionType, resolutionRemarks } = result.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch and validate clearance
      const clearance = await getClearanceForValidation(clearanceId);

      if (!clearance) {
        throw new Error("Clearance not found.");
      }

      if (clearance.status !== "pending") {
        throw new Error(`Cannot resolve a ${clearance.status} clearance. Only pending clearances can be resolved.`);
      }

      // 2. Determine new status
      const newStatus = resolutionType === "paid" ? "cleared" : "waived";

      // 3. Update clearance
      await tx
        .update(studentClearances)
        .set({
          status: newStatus,
          resolutionType: resolutionType as ResolutionType,
          resolutionRemarks: resolutionRemarks ?? null,
          resolvedBy: session.userId,
          resolvedAt: new Date(),
        })
        .where(eq(studentClearances.id, clearanceId));

      // 4. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "clearance_resolved",
        targetEntity: "student_clearances",
        targetId: clearanceId,
        previousState: { status: clearance.status },
        newState: {
          status: newStatus,
          resolutionType,
          resolutionTypeLabel: RESOLUTION_TYPE_LABELS[resolutionType as ResolutionType],
          resolutionRemarks,
          outstandingAmount: clearance.outstandingAmount,
        },
      }, { throwOnFail: true });
    });

    logger.info("[clearances] Clearance resolved", {
      clearanceId,
      resolutionType,
      actorId: session.userId,
    });

    revalidatePath("/staff/approvals");
    revalidatePath(`/admin/clearances/${clearanceId}`);

    return {
      success: true,
      message: `Clearance ${resolutionType === "paid" ? "cleared" : resolutionType}.`,
    };
  } catch (error: unknown) {
    logger.error("[clearances] Failed to resolve clearance", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Batch Generate EOY Clearances Action ─────────────────────────────────────

/**
 * Batch generate end-of-year clearances for all students in a school year.
 * Students with zero or negative balance get "cleared" status.
 * Students with positive balance get "pending" status.
 */
export async function batchGenerateEOYClearancesAction(
  _prevState: BatchGenerateEOYClearancesFormState,
  formData: FormData
): Promise<BatchGenerateEOYClearancesFormState> {
  const session = await requireSession();

  // Only admin/super_admin can batch generate
  if (!["admin", "super_admin"].includes(session.role)) {
    return { message: "Only administrators can batch generate clearances." };
  }

  const result = parseFormData(BatchGenerateEOYClearancesSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { schoolYearId } = result.data;

  try {
    let generatedCount = 0;
    let pendingCount = 0;
    let clearedCount = 0;

    await db.transaction(async (tx) => {
      // 1. Get all enrolled students with their assessment balances
      const enrollmentData = await tx
        .select({
          enrollmentId: enrollments.id,
          studentId: enrollments.studentId,
          balance: assessments.balance,
        })
        .from(enrollments)
        .innerJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
        .where(
          and(
            eq(enrollments.schoolYearId, schoolYearId),
            eq(enrollments.status, "enrolled"),
            isNull(assessments.cancelledAt)
          )
        );

      // 2. Create clearance records
      for (const enrollment of enrollmentData) {
        // Check if clearance already exists
        const exists = await clearanceExistsForEnrollment(enrollment.enrollmentId, "end_of_year");
        if (exists) continue;

        const balance = Number(enrollment.balance);
        const status = balance <= 0 ? "cleared" : "pending";

        await tx.insert(studentClearances).values({
          studentId: enrollment.studentId,
          enrollmentId: enrollment.enrollmentId,
          schoolYearId,
          clearanceType: "end_of_year",
          outstandingAmount: enrollment.balance,
          status,
          createdBy: session.userId,
        });

        generatedCount++;
        if (status === "pending") {
          pendingCount++;
        } else {
          clearedCount++;
        }
      }

      // 3. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "batch_eoy_clearances_generated",
        targetEntity: "student_clearances",
        targetId: schoolYearId,
        newState: {
          schoolYearId,
          generatedCount,
          pendingCount,
          clearedCount,
        },
      }, { throwOnFail: true });
    });

    logger.info("[clearances] Batch EOY clearances generated", {
      schoolYearId,
      generatedCount,
      pendingCount,
      clearedCount,
      actorId: session.userId,
    });

    revalidatePath("/staff/approvals");
    revalidatePath("/admin/settings");

    return {
      success: true,
      message: `Generated ${generatedCount} clearance records (${clearedCount} cleared, ${pendingCount} pending).`,
      generatedCount,
      pendingCount,
      clearedCount,
    };
  } catch (error: unknown) {
    logger.error("[clearances] Failed to batch generate EOY clearances", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}
