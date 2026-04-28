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
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
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

  // Check for duplicate active enrollment in same school year
  const existing = await db
    .select({ id: enrollments.id, status: enrollments.status })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.schoolYearId, schoolYearId)
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0].status !== "cancelled") {
    return {
      errors: {
        _form: [
          `Student already has an active enrollment for this school year (status: ${existing[0].status}).`,
        ],
      },
    };
  }

  try {
    const [newEnrollment] = await db
      .insert(enrollments)
      .values({
        studentId,
        schoolYearId,
        gradeLevelId,
        sectionId: sectionId ?? null,
        registrationId: registrationId ?? null,
        status: "pending",
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: enrollments.id });

    await audit(
      session.userId,
      session.role,
      "enrollment_created",
      "enrollments",
      newEnrollment.id,
      { studentId, schoolYearId, gradeLevelId, status: "pending" }
    );

    logger.info("[enrollments] Enrollment created", {
      enrollmentId: newEnrollment.id,
      studentId,
      actorId: session.userId,
    });

    revalidatePath("/admin/enrollments");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true, enrollmentId: newEnrollment.id };
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
    columns: { id: true, status: true, studentId: true },
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
    await db
      .update(enrollments)
      .set(updateValues as Parameters<typeof db.update>[0] extends any ? any : never)
      .where(eq(enrollments.id, enrollmentId));

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
