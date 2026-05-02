"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { enrollments, students, auditLogs, schoolYears, gradeLevels, assessments } from "@/lib/db/schema";
import { eq, and, ne, isNull, desc } from "drizzle-orm";
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
import { validateGradeProgression } from "@/lib/utils/enrollment-grade";

const OUTSTANDING_PAYMENT_EPSILON = 0.009;
const MIN_CANCEL_REMARKS_WITH_BALANCE = 15;

function formatPhp(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

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

/** Enrollments may only be created for the single active (current) school year. */
async function getActiveSchoolYearId(): Promise<string | null> {
  const rows = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);
  return rows[0]?.id ?? null;
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

  const activeSchoolYearId = await getActiveSchoolYearId();
  if (!activeSchoolYearId) {
    return {
      message:
        "No active school year is configured. Set the current school year under School Years before enrolling.",
    };
  }
  if (schoolYearId !== activeSchoolYearId) {
    return {
      errors: {
        schoolYearId: [
          "Enrollments are only allowed for the current (active) school year. You cannot enroll for a past year.",
        ],
      },
    };
  }

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

  const [maxGradeRow] = await db
    .select({ maxOrder: gradeLevels.order })
    .from(gradeLevels)
    .orderBy(desc(gradeLevels.order))
    .limit(1);
  const maxCatalogOrder = maxGradeRow?.maxOrder ?? 0;

  const [newGradeRow] = await db
    .select({ order: gradeLevels.order })
    .from(gradeLevels)
    .where(eq(gradeLevels.id, gradeLevelId))
    .limit(1);
  if (!newGradeRow) {
    return { errors: { gradeLevelId: ["Invalid grade level."] } };
  }

  const [priorEnrollmentRow] = await db
    .select({ gradeOrder: gradeLevels.order })
    .from(enrollments)
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        ne(enrollments.status, "cancelled"),
        ne(enrollments.schoolYearId, schoolYearId)
      )
    )
    .orderBy(desc(schoolYears.startDate))
    .limit(1);

  const priorGradeOrder = priorEnrollmentRow?.gradeOrder ?? null;
  const hasPriorEnrollmentElsewhere = priorEnrollmentRow != null;

  if (hasPriorEnrollmentElsewhere && studentType !== "old_student") {
    return {
      errors: {
        studentType: [
          "This student has a prior enrollment in SRAMS. Enrollment type must be Old (returning).",
        ],
      },
    };
  }

  if (!hasPriorEnrollmentElsewhere && studentType === "old_student") {
    return {
      errors: {
        studentType: [
          "Old (returning) applies only when the student has a prior enrollment in another school year.",
        ],
      },
    };
  }

  const progression = validateGradeProgression({
    priorGradeOrder,
    newGradeOrder: newGradeRow.order,
    maxCatalogOrder,
  });
  if (!progression.ok) {
    return { errors: { gradeLevelId: [progression.message] } };
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

  let assessmentForCancel: { id: string; totalPaid: string } | null = null;
  if (
    action === "cancel" &&
    (enrollment.status === "assessed" || enrollment.status === "enrolled")
  ) {
    assessmentForCancel =
      (await db.query.assessments.findFirst({
        where: eq(assessments.enrollmentId, enrollmentId),
        columns: { id: true, totalPaid: true },
      })) ?? null;
  }

  if (action === "cancel") {
    const paid =
      assessmentForCancel != null ? Number(assessmentForCancel.totalPaid) : 0;
    const hasOutstandingPayments = paid > OUTSTANDING_PAYMENT_EPSILON;

    if (
      hasOutstandingPayments &&
      (enrollment.status === "assessed" || enrollment.status === "enrolled")
    ) {
      if (!hasPermission(session.role, "enrollments:cancel_with_balance")) {
        return {
          message: `This enrollment has collected ${formatPhp(paid)} on the assessment ledger. Void posted payments on the ledger first (Cashier), then cancel. If you must cancel without voiding in the system, ask an administrator.`,
        };
      }
      const remarks = (cancelRemarks ?? "").trim();
      if (remarks.length < MIN_CANCEL_REMARKS_WITH_BALANCE) {
        return {
          errors: {
            cancelRemarks: [
              `Cancelling with outstanding payments requires a detailed audit reason (at least ${MIN_CANCEL_REMARKS_WITH_BALANCE} characters).`,
            ],
          },
        };
      }
    }
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
    await db.transaction(async (tx) => {
      await tx.update(enrollments).set(updateValues).where(eq(enrollments.id, enrollmentId));

      if (action === "cancel" && assessmentForCancel) {
        await tx
          .update(assessments)
          .set({
            cancelledAt: new Date(),
            cancelledBy: session.userId,
            updatedAt: new Date(),
            updatedBy: session.userId,
          })
          .where(eq(assessments.id, assessmentForCancel.id));
      }
    });

    const verb = action === "cancel" ? "cancelled" : "override_marked_enrolled";
    await audit(session.userId, session.role, verb, "enrollments", enrollmentId, {
      ...updateValues,
      ...(assessmentForCancel && action === "cancel"
        ? { assessmentId: assessmentForCancel.id }
        : {}),
    });

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
