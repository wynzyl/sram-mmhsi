"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag, forceUpdateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  registrations,
  type EnrollmentIntakeDocuments,
} from "@/lib/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import { validateGradeProgression } from "@/lib/utils/enrollment-grade";
import { collectPgErrorText, isUndefinedColumnError } from "@/lib/utils/pg-error";
import { extractUniqueConstraint } from "@/lib/utils/error-handlers";
import { parseFormData } from "@/lib/utils/form-validation";
import {
  ConfirmEnrollmentSchema,
  QuickConfirmEnrollmentSchema,
} from "./enrollments.schema";
import type {
  ConfirmEnrollmentFormState,
  QuickConfirmEnrollmentFormState,
} from "./enrollments.schema";

/**
 * ENROLLMENT CONFIRMATION ACTIONS (Phase 2)
 *
 * These actions handle the list-first enrollment workflow where students
 * automatically appear in the "Ready to Enroll" queue and registrars
 * confirm their enrollment with a single click.
 */

// ─── Confirm Enrollment Action (Full) ────────────────────────────────────────

/**
 * Confirm enrollment from the Ready to Enroll queue.
 *
 * This is the "full" version that allows section assignment and additional fields.
 * Use this when confirming from a drawer/modal with form fields.
 */
export async function confirmEnrollmentAction(
  _prevState: ConfirmEnrollmentFormState,
  formData: FormData
): Promise<ConfirmEnrollmentFormState> {
  const session = await requireSession();

  // Check permission (use create permission for now, could add specific confirm permission later)
  if (!hasPermission(session.role, "enrollments:create")) {
    return { message: "You do not have permission to confirm enrollments." };
  }

  // Parse and validate input
  const result = parseFormData(ConfirmEnrollmentSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { studentId, schoolYearId, gradeLevelId, sectionId, studentType, registrationId, previousSchool } =
    result.data;

  // Validate school year is active
  const schoolYear = await db.query.schoolYears.findFirst({
    where: and(eq(schoolYears.id, schoolYearId), eq(schoolYears.isActive, true)),
    columns: { id: true, label: true },
  });

  if (!schoolYear) {
    return {
      errors: {
        schoolYearId: [
          "The selected school year is not active. Enrollments are only allowed for the active school year.",
        ],
      },
    };
  }

  // Validate student exists and is active
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

  // Check for duplicate enrollment (already enrolled in this school year)
  const existingEnrollment = await db
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

  if (existingEnrollment.length > 0) {
    return {
      errors: {
        _form: [
          `Student already has an active enrollment for this school year (status: ${existingEnrollment[0].status}).`,
        ],
      },
    };
  }

  // Validate grade level exists
  const gradeLevel = await db.query.gradeLevels.findFirst({
    where: eq(gradeLevels.id, gradeLevelId),
    columns: { id: true, name: true, order: true },
  });

  if (!gradeLevel) {
    return { errors: { gradeLevelId: ["Invalid grade level."] } };
  }

  // Additional validation based on student type
  let intakeDocuments: EnrollmentIntakeDocuments | null = null;

  if (studentType === "new_student" || studentType === "transferee") {
    // Must have a linked registration
    if (!registrationId) {
      return {
        errors: {
          registrationId: ["Registration ID is required for new and transferee students."],
        },
      };
    }

    // Validate registration exists and is approved
    const registration = await db.query.registrations.findFirst({
      where: eq(registrations.id, registrationId),
      columns: {
        id: true,
        studentId: true,
        schoolYearId: true,
        status: true,
        intakeDocuments: true,
      },
    });

    if (!registration) {
      return {
        errors: {
          registrationId: ["Registration not found."],
        },
      };
    }

    if (registration.status !== "approved") {
      return {
        errors: {
          registrationId: ["Only approved registrations can be confirmed for enrollment."],
        },
      };
    }

    if (registration.studentId !== studentId) {
      return {
        errors: {
          registrationId: ["Registration does not belong to the selected student."],
        },
      };
    }

    if (registration.schoolYearId !== schoolYearId) {
      return {
        errors: {
          registrationId: ["Registration is not for the active school year."],
        },
      };
    }

    // Copy intake documents from registration
    intakeDocuments = registration.intakeDocuments as EnrollmentIntakeDocuments | null;
  }

  if (studentType === "old_student") {
    // Validate grade progression for returning students
    const [maxGradeRow] = await db
      .select({ maxOrder: gradeLevels.order })
      .from(gradeLevels)
      .orderBy(desc(gradeLevels.order))
      .limit(1);
    const maxCatalogOrder = maxGradeRow?.maxOrder ?? 0;

    // Get previous enrollment to check grade progression
    const [priorEnrollment] = await db
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

    const priorGradeOrder = priorEnrollment?.gradeOrder ?? null;

    if (!priorEnrollment) {
      return {
        errors: {
          studentType: [
            "No previous enrollment found for this student. Student type should be 'New' or 'Transferee'.",
          ],
        },
      };
    }

    // Validate grade progression
    const progression = validateGradeProgression({
      priorGradeOrder,
      newGradeOrder: gradeLevel.order,
      maxCatalogOrder,
    });

    if (!progression.ok) {
      return { errors: { gradeLevelId: [progression.message] } };
    }
  }

  // Create the enrollment
  let newEnrollmentId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      // If transferee and previousSchool provided, update student record
      if (studentType === "transferee" && previousSchool && previousSchool !== student.previousSchool) {
        await tx
          .update(students)
          .set({
            previousSchool,
            updatedAt: new Date(),
            updatedBy: session.userId,
          })
          .where(eq(students.id, studentId));
      }

      // Create enrollment
      const [created] = await tx
        .insert(enrollments)
        .values({
          studentId,
          schoolYearId,
          gradeLevelId,
          sectionId: sectionId ?? null,
          registrationId: registrationId ?? null,
          studentType,
          intakeDocuments,
          status: "pending",
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: enrollments.id });

      newEnrollmentId = created.id;
    });

    // Audit log (outside transaction - uses standardized helper)
    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "enrollment_confirmed",
      targetEntity: "enrollments",
      targetId: newEnrollmentId!,
      newState: {
        studentId,
        schoolYearId,
        gradeLevelId,
        sectionId,
        studentType,
        registrationId,
        status: "pending",
      },
    });

    logger.info("[enrollment-confirmation] Enrollment confirmed", {
      enrollmentId: newEnrollmentId,
      studentId,
      studentType,
      actorId: session.userId,
    });

    // Revalidate paths
    revalidatePath("/staff/enrollments");
    revalidatePath("/staff/students");
    revalidatePath(`/staff/students/${studentId}`);
    if (registrationId) {
      revalidatePath("/staff/registrations");
    }
    // Use forceUpdateTag for enrollments (read-your-own-writes - immediate consistency)
    forceUpdateTag(CACHE_TAGS.ENROLLMENTS);
    // Confirmation creates a new enrollment row — dashboard headcount KPIs change.
    invalidateTag(CACHE_TAGS.DASHBOARD);

    return { success: true, enrollmentId: newEnrollmentId };
  } catch (err) {
    const detail = collectPgErrorText(err);
    logger.error("[enrollment-confirmation] Failed to confirm enrollment", { error: detail });

    if (isUndefinedColumnError(err)) {
      return {
        message:
          "Database schema is missing required columns. Apply pending migrations (`npm run db:migrate`).",
      };
    }

    const uq = extractUniqueConstraint(err);
    if (uq === "enrollment_unique_sy_idx" || detail.includes("enrollment_unique_sy_idx")) {
      return {
        errors: {
          _form: [
            "This student already has an active enrollment for this school year. Refresh the page and try again.",
          ],
        },
      };
    }

    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Quick Confirm Enrollment Action ─────────────────────────────────────────

/**
 * One-click enrollment confirmation without additional fields.
 *
 * This is the simplified version for quick confirmation directly from the table.
 * Section assignment can be done later.
 */
export async function quickConfirmEnrollmentAction(
  _prevState: QuickConfirmEnrollmentFormState,
  formData: FormData
): Promise<QuickConfirmEnrollmentFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "enrollments:create")) {
    return { message: "You do not have permission to confirm enrollments." };
  }

  const parseResult = parseFormData(QuickConfirmEnrollmentSchema, formData);
  if (!parseResult.success) {
    return { errors: parseResult.errors };
  }

  const { studentId, schoolYearId, gradeLevelId, studentType, registrationId } = parseResult.data;

  // Delegate to full confirmation action (with no section assignment)
  const fullFormData = new FormData();
  fullFormData.set("studentId", studentId);
  fullFormData.set("schoolYearId", schoolYearId);
  fullFormData.set("gradeLevelId", gradeLevelId);
  fullFormData.set("studentType", studentType);
  if (registrationId) {
    fullFormData.set("registrationId", registrationId);
  }

  return confirmEnrollmentAction({}, fullFormData);
}

// ─── Fetch Ready-to-Enroll Detail (Lazy Load) ─────────────────────────────────

import {
  getReadyToEnrollDetail,
  getActiveSchoolYearId,
  type ReadyToEnrollDetail,
} from "./enrollments-queue.queries";

/**
 * Fetch full detail for a student (including intakeDocuments) for the drawer.
 *
 * This is a server action wrapper around the query function, allowing
 * client components to lazy-load heavy data only when needed.
 *
 * Returns ReadyToEnrollDetail or null if not found.
 */
export async function fetchReadyToEnrollDetailAction(
  studentId: string
): Promise<{ success: true; data: ReadyToEnrollDetail } | { success: false; error: string }> {
  try {
    const session = await requireSession();

    if (!hasPermission(session.role, "enrollments:read")) {
      return { success: false, error: "You do not have permission to view enrollment details." };
    }

    const activeSchoolYearId = await getActiveSchoolYearId();
    if (!activeSchoolYearId) {
      return { success: false, error: "No active school year configured." };
    }

    const detail = await getReadyToEnrollDetail(studentId, activeSchoolYearId);
    if (!detail) {
      return { success: false, error: "Student not found in enrollment queue." };
    }

    return { success: true, data: detail };
  } catch (err) {
    logger.error("[enrollment-confirmation] Failed to fetch detail", { studentId, error: err });
    return { success: false, error: "Failed to load student details." };
  }
}
