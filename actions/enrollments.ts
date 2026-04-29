"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  sections,
  registrations,
  auditLogs,
  assessments,
  assessmentItems,
  feeSchedules,
  feeScheduleItems,
} from "@/lib/db/schema";
import { eq, and, sql, ne } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateEnrollmentSchema,
  UpdateEnrollmentStatusSchema,
} from "@/lib/validators/enrollment";
import type {
  EnrollmentFormState,
  UpdateEnrollmentFormState,
} from "@/lib/validators/enrollment";
import { logger } from "@/lib/observability/logger";

// ─── Audit Helper ─────────────────────────────────────────────────────────────

async function audit(
  actorId: string,
  actorRole: string,
  action: string,
  targetEntity: string,
  targetId: string,
  newState?: object
) {
  try {
    await db.insert(auditLogs).values({
      actor: actorId,
      actorRole,
      action,
      targetEntity,
      targetId,
      newState: newState ? JSON.stringify(newState) : undefined,
      correlationId: crypto.randomUUID(),
    });
  } catch (err) {
    logger.error("[audit] Failed to write", { error: String(err) });
  }
}

// ─── Create Enrollment Action ─────────────────────────────────────────────────

export async function createEnrollmentAction(
  _prevState: EnrollmentFormState,
  formData: FormData
): Promise<EnrollmentFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "enrollments:create")) {
    return { message: "You do not have permission to create enrollments." };
  }

  const parsed = CreateEnrollmentSchema.safeParse({
    studentId: formData.get("studentId"),
    schoolYearId: formData.get("schoolYearId"),
    gradeLevelId: formData.get("gradeLevelId"),
    sectionId: formData.get("sectionId") || undefined,
    registrationId: formData.get("registrationId") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as EnrollmentFormState["errors"] };
  }

  const { studentId, schoolYearId, gradeLevelId, sectionId, registrationId } = parsed.data;

  // Check student exists
  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.isActive, true)),
    columns: { id: true, firstName: true, lastName: true, referenceNumber: true },
  });
  if (!student) {
    return { errors: { studentId: ["Student not found or inactive."] } };
  }

  // Only students with an APPROVED registration may be enrolled
  const approvedReg = await db.query.registrations.findFirst({
    where: and(
      eq(registrations.studentId, studentId),
      eq(registrations.status, "approved")
    ),
    columns: { id: true },
  });
  if (!approvedReg) {
    return {
      errors: {
        studentId: [
          "This student does not have an approved registration and cannot be enrolled. " +
          "Please approve the student's registration first.",
        ],
      },
    };
  }

  // Check for duplicate active enrollment in same school year
  const existingActive = await db
    .select({ id: enrollments.id, status: enrollments.status })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.schoolYearId, schoolYearId),
        ne(enrollments.status, "cancelled")
      )
    )
    .limit(1);

  if (existingActive.length > 0) {
    return {
      errors: {
        _form: [
          `Student already has an active enrollment for this school year (status: ${existingActive[0].status}).`,
        ],
      },
    };
  }

  try {
    // Check for active fee schedule first
    const schedule = await db.query.feeSchedules.findFirst({
      where: and(
        eq(feeSchedules.schoolYearId, schoolYearId),
        eq(feeSchedules.gradeLevelId, gradeLevelId),
        eq(feeSchedules.isActive, true)
      ),
    });

    if (!schedule) {
      return { message: "Cannot enroll student: No active fee schedule found for this grade level. Please configure it in Finance first." };
    }

    const scheduleItems = await db
      .select()
      .from(feeScheduleItems)
      .where(eq(feeScheduleItems.feeScheduleId, schedule.id));

    if (scheduleItems.length === 0) {
      return { message: "Cannot enroll student: The fee schedule has no items configured." };
    }

    const assessmentTotalAmount = scheduleItems.reduce(
      (acc, item) => acc + (item.isDiscount ? -Number(item.amount) : Number(item.amount)),
      0
    );

    let newEnrollmentId: string | undefined;

    await db.transaction(async (tx) => {
      // 1. Create Enrollment as 'assessed'
      const [newEnrollment] = await tx
        .insert(enrollments)
        .values({
          studentId,
          schoolYearId,
          gradeLevelId,
          sectionId: sectionId ?? null,
          registrationId: registrationId ?? null,
          status: "assessed",
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: enrollments.id });
      
      newEnrollmentId = newEnrollment.id;

      // 2. Create Assessment
      const [newAssessment] = await tx
        .insert(assessments)
        .values({
          enrollmentId: newEnrollment.id,
          studentId,
          schoolYearId,
          totalAmount: String(assessmentTotalAmount),
          totalPaid: "0.00",
          balance: String(assessmentTotalAmount),
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: assessments.id });

      // 3. Create Assessment Items
      const itemsToInsert = scheduleItems.map((item) => ({
        assessmentId: newAssessment.id,
        description: item.description,
        amount: item.amount,
        isDiscount: item.isDiscount,
        createdBy: session.userId,
        updatedBy: session.userId,
      }));

      await tx.insert(assessmentItems).values(itemsToInsert);

      // 4. Audit Log
      await tx.insert(auditLogs).values({
        actor: session.userId,
        actorRole: session.role,
        action: "enrollment_created_and_assessed",
        targetEntity: "enrollments",
        targetId: newEnrollment.id,
        newState: JSON.stringify({ studentId, schoolYearId, gradeLevelId, status: "assessed" }),
      });
    });

    logger.info("[enrollments] Enrollment created and auto-assessed", {
      enrollmentId: newEnrollmentId,
      studentId,
      actorId: session.userId,
    });

    revalidatePath("/admin/enrollments");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true, enrollmentId: newEnrollmentId };
  } catch (err) {
    logger.error("[enrollments] Failed to create enrollment", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Update Enrollment Status Action ─────────────────────────────────────────

export async function updateEnrollmentStatusAction(
  _prevState: UpdateEnrollmentFormState,
  formData: FormData
): Promise<UpdateEnrollmentFormState> {
  const session = await requireSession();

  const parsed = UpdateEnrollmentStatusSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    action: formData.get("action"),
    sectionId: formData.get("sectionId") || undefined,
    cancelRemarks: formData.get("cancelRemarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { enrollmentId, action, sectionId, cancelRemarks } = parsed.data;

  // Permission check per action
  const permissionMap = {
    assess: "enrollments:create",
    enroll: "enrollments:create",
    cancel: "enrollments:cancel",
  } as const;

  if (!hasPermission(session.role, permissionMap[action])) {
    return { message: `You do not have permission to ${action} enrollments.` };
  }

  // Fetch current enrollment
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(enrollments.id, enrollmentId),
    columns: { id: true, status: true, studentId: true, schoolYearId: true, gradeLevelId: true },
  });

  if (!enrollment) {
    return { message: "Enrollment not found." };
  }

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    assess: ["pending"],
    enroll: ["assessed"],
    cancel: ["pending", "assessed"],
  };

  if (!validTransitions[action]?.includes(enrollment.status)) {
    return {
      message: `Cannot ${action} an enrollment with status "${enrollment.status}".`,
    };
  }

  let assessmentTotalAmount = 0;
  let scheduleItems: any[] = [];
  
  if (action === "assess") {
    const schedule = await db.query.feeSchedules.findFirst({
      where: and(
        eq(feeSchedules.schoolYearId, enrollment.schoolYearId),
        eq(feeSchedules.gradeLevelId, enrollment.gradeLevelId),
        eq(feeSchedules.isActive, true)
      ),
    });

    if (!schedule) {
      return { message: "No active fee schedule found for this grade level. Please configure it in Finance first." };
    }

    scheduleItems = await db
      .select()
      .from(feeScheduleItems)
      .where(eq(feeScheduleItems.feeScheduleId, schedule.id));

    if (scheduleItems.length === 0) {
      return { message: "The fee schedule has no items configured. Please add items before assessing." };
    }

    assessmentTotalAmount = scheduleItems.reduce(
      (acc, item) => acc + (item.isDiscount ? -Number(item.amount) : Number(item.amount)),
      0
    );
  }

  const statusMap = { assess: "assessed", enroll: "enrolled", cancel: "cancelled" } as const;
  const newStatus = statusMap[action];

  const updateValues: Record<string, unknown> = {
    status: newStatus,
    updatedBy: session.userId,
    updatedAt: new Date(),
  };

  if (action === "enroll") {
    updateValues.enrolledAt = new Date();
    if (sectionId) updateValues.sectionId = sectionId;
  }

  if (action === "cancel") {
    updateValues.cancelledAt = new Date();
    updateValues.cancelRemarks = cancelRemarks ?? null;
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(enrollments)
        .set(updateValues as Parameters<typeof db.update>[0] extends any ? any : never)
        .where(eq(enrollments.id, enrollmentId));

      if (action === "assess") {
        const [newAssessment] = await tx
          .insert(assessments)
          .values({
            enrollmentId,
            studentId: enrollment.studentId,
            schoolYearId: enrollment.schoolYearId,
            totalAmount: String(assessmentTotalAmount),
            totalPaid: "0",
            balance: String(assessmentTotalAmount),
            createdBy: session.userId,
            updatedBy: session.userId,
          })
          .returning({ id: assessments.id });

        if (scheduleItems.length > 0) {
          const itemsToInsert = scheduleItems.map((item) => ({
            assessmentId: newAssessment.id,
            description: item.description,
            amount: String(item.amount),
            isDiscount: item.isDiscount,
            createdBy: session.userId,
            updatedBy: session.userId,
          }));
          await tx.insert(assessmentItems).values(itemsToInsert);
        }
      }
    });

    await audit(
      session.userId,
      session.role,
      `enrollment_${action}d`,
      "enrollments",
      enrollmentId,
      { newStatus, sectionId }
    );

    logger.info("[enrollments] Status updated", {
      enrollmentId,
      action,
      newStatus,
      actorId: session.userId,
    });

    revalidatePath("/admin/enrollments");
    revalidatePath(`/admin/students/${enrollment.studentId}`);

    return { success: true, message: `Enrollment ${action}ed successfully.` };
  } catch (err) {
    logger.error("[enrollments] Failed to update status", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
