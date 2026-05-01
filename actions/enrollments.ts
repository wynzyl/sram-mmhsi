"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { enrollments, students, auditLogs } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateEnrollmentSchema,
  UpdateEnrollmentStatusSchema,
} from "@/lib/validators/enrollment";
import type {
  CreateEnrollmentInput,
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

  const studentTypeRaw = formData.get("studentType");

  const parsed = CreateEnrollmentSchema.safeParse({
    studentId: formData.get("studentId"),
    schoolYearId: formData.get("schoolYearId"),
    gradeLevelId: formData.get("gradeLevelId"),
    sectionId: formData.get("sectionId") || undefined,
    registrationId: formData.get("registrationId") || undefined,
    studentType:
      typeof studentTypeRaw === "string" && studentTypeRaw.length > 0
        ? studentTypeRaw
        : "new_student",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as EnrollmentFormState["errors"] };
  }

  const { studentId, schoolYearId, gradeLevelId, sectionId, registrationId, studentType } =
    parsed.data;

  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.isActive, true)),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      referenceNumber: true,
      previousSchool: true,
    },
  });
  if (!student) {
    return { errors: { studentId: ["Student not found or inactive."] } };
  }

  if (studentType === "transferee") {
    const ps = student.previousSchool?.trim();
    if (!ps) {
      return {
        message:
          "Transferee enrollments require “Previous school” on the student profile. Edit the student first.",
      };
    }
  }

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

  let newEnrollmentId: string | undefined;

  try {
    const [created] = await db
      .insert(enrollments)
      .values({
        studentId,
        schoolYearId,
        gradeLevelId,
        sectionId: sectionId ?? null,
        registrationId: registrationId ?? null,
        studentType: studentType satisfies CreateEnrollmentInput["studentType"],
        status: "pending",
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: enrollments.id });

    newEnrollmentId = created.id;

    await db.insert(auditLogs).values({
      actor: session.userId,
      actorRole: session.role,
      action: "enrollment_created_pending",
      targetEntity: "enrollments",
      targetId: created.id,
      newState: JSON.stringify({
        studentId,
        schoolYearId,
        gradeLevelId,
        studentType,
        status: "pending",
      }),
    });

    logger.info("[enrollments] Enrollment created (pending)", {
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

// ─── Update Enrollment Status (cancel / admin override enrolled) ────────────

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

  const permissionMap = {
    cancel: "enrollments:cancel",
    override_enroll: "enrollments:override_enroll",
  } as const;

  if (!hasPermission(session.role, permissionMap[action])) {
    return { message: `You do not have permission to perform this enrollment action.` };
  }

  const enrollment = await db.query.enrollments.findFirst({
    where: eq(enrollments.id, enrollmentId),
    columns: {
      id: true,
      status: true,
      studentId: true,
      schoolYearId: true,
      gradeLevelId: true,
    },
  });

  if (!enrollment) {
    return { message: "Enrollment not found." };
  }

  const validTransitions: Record<typeof action, readonly string[]> = {
    cancel: ["pending", "assessed", "enrolled"],
    override_enroll: ["assessed"],
  };

  if (!validTransitions[action].includes(enrollment.status)) {
    return {
      message: `This action cannot be applied when enrollment status is "${enrollment.status}".`,
    };
  }

  const updateValues = {
    status: action === "cancel" ? ("cancelled" as const) : ("enrolled" as const),
    updatedBy: session.userId,
    updatedAt: new Date(),
    ...(action === "override_enroll" && {
      enrolledAt: new Date(),
      ...(sectionId ? { sectionId } : {}),
    }),
    ...(action === "cancel" && {
      cancelledAt: new Date(),
      cancelledBy: session.userId,
      cancelRemarks: cancelRemarks ?? null,
    }),
  };

  try {
    await db.update(enrollments).set(updateValues).where(eq(enrollments.id, enrollmentId));

    const verb = action === "cancel" ? "cancelled" : "override_marked_enrolled";
    await audit(session.userId, session.role, verb, "enrollments", enrollmentId, updateValues);

    logger.info("[enrollments] Status updated", {
      enrollmentId,
      action,
      actorId: session.userId,
    });

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/assessments");
    revalidatePath(`/admin/students/${enrollment.studentId}`);

    return {
      success: true,
      message:
        action === "cancel"
          ? "Enrollment cancelled."
          : "Enrollment marked enrolled (manual override — no payment recorded).",
    };
  } catch (err) {
    logger.error("[enrollments] Failed to update status", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
