"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  assessments,
  registrations,
  auditLogs,
  type EnrollmentIntakeDocuments,
} from "@/lib/db/schema";
import { eq, and, ne, isNull, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logUpdateAction } from "@/lib/utils/audit-logger";
import { extractUniqueConstraint } from "@/lib/utils/error-handlers";
import { formatCurrency } from "@/lib/utils/currency";
import { getActiveSchoolYearId } from "@/lib/utils/query-helpers";
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
import { collectPgErrorText, isUndefinedColumnError } from "@/lib/utils/pg-error";
import { parseIntakeDocumentStatus } from "@/lib/validators/intake-documents";

const OUTSTANDING_PAYMENT_EPSILON = 0.009;
const MIN_CANCEL_REMARKS_WITH_BALANCE = 15;

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
  const studentTypeResolved =
    typeof studentTypeRaw === "string" && studentTypeRaw.length > 0 ? studentTypeRaw : "new_student";

  const parsed = CreateEnrollmentSchema.safeParse({
    studentId: formData.get("studentId"),
    schoolYearId: formData.get("schoolYearId"),
    gradeLevelId: formData.get("gradeLevelId"),
    sectionId: formData.get("sectionId") || undefined,
    registrationId: formData.get("registrationId") || undefined,
    studentType: studentTypeResolved,
    previousSchool: formData.get("previousSchool"),
    intakeForm138: parseIntakeDocumentStatus(formData.get("intakeForm138")),
    intakeBirthCertificatePsa: parseIntakeDocumentStatus(formData.get("intakeBirthCertificatePsa")),
    intakeGoodMoralCharacter: parseIntakeDocumentStatus(formData.get("intakeGoodMoralCharacter")),
    intakeQualifiedVoucher: parseIntakeDocumentStatus(formData.get("intakeQualifiedVoucher")),
    intakeEscCertificate: parseIntakeDocumentStatus(formData.get("intakeEscCertificate")),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as EnrollmentFormState["errors"] };
  }

  const {
    studentId,
    schoolYearId,
    gradeLevelId,
    sectionId,
    registrationId,
    studentType,
    intakeForm138,
    intakeBirthCertificatePsa,
    intakeGoodMoralCharacter,
    intakeQualifiedVoucher,
    intakeEscCertificate,
    previousSchool,
  } = parsed.data;

  let intakeDocuments: EnrollmentIntakeDocuments | null = null;
  if (studentType === "new_student" || studentType === "transferee") {
    intakeDocuments = {
      form138: intakeForm138!,
      birthCertificatePsa: intakeBirthCertificatePsa!,
      goodMoralCharacter: intakeGoodMoralCharacter!,
      qualifiedVoucher: intakeQualifiedVoucher!,
      escCertificate: intakeEscCertificate!,
    };
  }

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
    },
  });
  if (!student) {
    return { errors: { studentId: ["Student not found or inactive."] } };
  }

  if (registrationId) {
    const reg = await db.query.registrations.findFirst({
      where: eq(registrations.id, registrationId),
      columns: {
        id: true,
        studentId: true,
        schoolYearId: true,
        status: true,
      },
    });
    if (!reg) {
      return {
        errors: {
          _form: [
            "Linked registration was not found. Refresh the page or clear your browser cache and try again.",
          ],
        },
      };
    }
    if (reg.studentId !== studentId) {
      return {
        errors: { _form: ["That registration does not belong to the selected student."] },
      };
    }
    if (reg.schoolYearId !== schoolYearId) {
      return {
        errors: {
          _form: ["That registration is not for the current school year; remove the stale link."],
        },
      };
    }
    if (reg.status !== "approved") {
      return {
        errors: {
          _form: ["Only an approved registration can be linked to a new enrollment."],
        },
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
    await db.transaction(async (tx) => {
      if (studentType === "transferee" && previousSchool) {
        await tx
          .update(students)
          .set({
            previousSchool,
            updatedAt: new Date(),
            updatedBy: session.userId,
          })
          .where(eq(students.id, studentId));
      }

      const [created] = await tx
        .insert(enrollments)
        .values({
          studentId,
          schoolYearId,
          gradeLevelId,
          sectionId: sectionId ?? null,
          registrationId: registrationId ?? null,
          studentType: studentType satisfies CreateEnrollmentInput["studentType"],
          intakeDocuments,
          status: "pending",
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: enrollments.id });

      newEnrollmentId = created.id;

      await tx.insert(auditLogs).values({
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
          intakeDocuments,
        }),
      });
    });

    logger.info("[enrollments] Enrollment created (pending)", {
      enrollmentId: newEnrollmentId,
      studentId,
      actorId: session.userId,
    });

    revalidatePath("/admin/enrollments");
    revalidatePath("/staff/enrollments");
    revalidatePath(`/admin/students/${studentId}`);
    revalidatePath(`/staff/students/${studentId}`);

    return { success: true, enrollmentId: newEnrollmentId };
  } catch (err) {
    const detail = collectPgErrorText(err);
    logger.error("[enrollments] Failed to create enrollment", { error: detail });

    if (isUndefinedColumnError(err)) {
      return {
        message:
          "The database is missing required columns (for example intake checklist storage). Apply pending migrations on this environment (`npm run db:migrate`), then try again.",
      };
    }

    const uq = extractUniqueConstraint(err);
    if (uq === "enrollment_unique_sy_idx" || detail.includes("enrollment_unique_sy_idx")) {
      return {
        errors: {
          _form: [
            "This student already has an enrollment for the current school year that is not cancelled. Open Enrollments and cancel or complete the existing record before creating another.",
          ],
        },
      };
    }

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
      sectionId: true,
      enrolledAt: true,
      updatedBy: true,
      updatedAt: true,
      cancelledAt: true,
      cancelledBy: true,
      cancelRemarks: true,
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
          message: `This enrollment has collected ${formatCurrency(paid)} on the assessment ledger. Void posted payments on the ledger first (Cashier), then cancel. If you must cancel without voiding in the system, ask an administrator.`,
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
            billingStatus: "cancelled",
            updatedAt: new Date(),
            updatedBy: session.userId,
          })
          .where(eq(assessments.id, assessmentForCancel.id));
      }
    });

    const updatedSnapshot = {
      ...updateValues,
      ...(assessmentForCancel && action === "cancel"
        ? { assessmentId: assessmentForCancel.id }
        : {}),
    };

    const previousSnapshot = {
      status: enrollment.status,
      updatedBy: enrollment.updatedBy,
      updatedAt: enrollment.updatedAt,
      ...(action === "override_enroll" && {
        enrolledAt: enrollment.enrolledAt,
        ...(sectionId ? { sectionId: enrollment.sectionId } : {}),
      }),
      ...(action === "cancel" && {
        cancelledAt: enrollment.cancelledAt,
        cancelledBy: enrollment.cancelledBy,
        cancelRemarks: enrollment.cancelRemarks,
      }),
      ...(assessmentForCancel && action === "cancel"
        ? { assessmentId: assessmentForCancel.id }
        : {}),
    };

    await logUpdateAction(
      session,
      "enrollments",
      enrollmentId,
      previousSnapshot,
      updatedSnapshot
    );

    logger.info("[enrollments] Status updated", {
      enrollmentId,
      action,
      actorId: session.userId,
    });

    revalidatePath("/admin/enrollments");
    revalidatePath("/staff/enrollments");
    revalidatePath("/admin/assessments");
    revalidatePath("/staff/assessments");
    revalidatePath(`/admin/students/${enrollment.studentId}`);
    revalidatePath(`/staff/students/${enrollment.studentId}`);

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
