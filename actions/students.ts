"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  students,
  parentsGuardians,
  studentGuardianLinks,
  registrations,
  auditLogs,
} from "@/lib/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CreateStudentSchema, ReviewRegistrationSchema } from "@/lib/validators/student";
import type { CreateStudentFormState, ReviewFormState } from "@/lib/validators/student";
import { generateStudentRef } from "@/lib/utils/reference";
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

// ─── Get next student sequence number ────────────────────────────────────────

async function getNextStudentSequence(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(students);
  return (result[0]?.count ?? 0) + 1;
}

// ─── Create Student Action ────────────────────────────────────────────────────

export async function createStudentAction(
  _prevState: CreateStudentFormState,
  formData: FormData
): Promise<CreateStudentFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "students:create")) {
    return { message: "You do not have permission to create students." };
  }

  // 2. Parse raw form data — guardians come in as JSON string from the client
  const guardiansRaw = formData.get("guardians");
  let guardiansParsed: unknown[] = [];
  try {
    guardiansParsed = JSON.parse(guardiansRaw as string);
  } catch {
    return { errors: { guardians: ["Guardian data is malformed."] } };
  }

  // 3. Validate
  const parsed = CreateStudentSchema.safeParse({
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || undefined,
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    gender: formData.get("gender") || undefined,
    address: formData.get("address") || undefined,
    schoolYearId: formData.get("schoolYearId"),
    gradeLevelId: formData.get("gradeLevelId"),
    guardians: guardiansParsed,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as CreateStudentFormState["errors"] };
  }

  const { guardians, schoolYearId, gradeLevelId, ...studentData } = parsed.data;

  // 4. Duplicate detection — same full name + DOB
  if (studentData.dateOfBirth) {
    const existing = await db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          ilike(students.firstName, studentData.firstName),
          ilike(students.lastName, studentData.lastName),
          eq(students.dateOfBirth, studentData.dateOfBirth),
          eq(students.isActive, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        errors: {
          _form: [
            `A student named ${studentData.firstName} ${studentData.lastName} with this date of birth already exists (ID: ${existing[0].id}).`,
          ],
        },
      };
    }
  }

  try {
    // 5. Generate reference number
    const seq = await getNextStudentSequence();
    const referenceNumber = generateStudentRef(new Date().getFullYear(), seq);

    // 6. Insert student
    const [newStudent] = await db
      .insert(students)
      .values({
        ...studentData,
        referenceNumber,
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: students.id });

    // 7. Insert guardians and link them
    for (const guardian of guardians) {
      const [newGuardian] = await db
        .insert(parentsGuardians)
        .values({
          firstName: guardian.firstName,
          middleName: guardian.middleName,
          lastName: guardian.lastName,
          relationship: guardian.relationship,
          contactNumber: guardian.contactNumber,
          email: guardian.email || undefined,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: parentsGuardians.id });

      await db.insert(studentGuardianLinks).values({
        studentId: newStudent.id,
        guardianId: newGuardian.id,
        isPrimary: guardian.isPrimary ?? false,
      });
    }

    // 8. Create pending registration
    await db.insert(registrations).values({
      studentId: newStudent.id,
      schoolYearId,
      gradeLevelId,
      status: "pending",
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    // 9. Audit log
    await audit(
      session.userId,
      session.role,
      "student_created",
      "students",
      newStudent.id,
      { referenceNumber, firstName: studentData.firstName, lastName: studentData.lastName }
    );

    logger.info("[students] Student created", {
      studentId: newStudent.id,
      referenceNumber,
      actorId: session.userId,
    });

    revalidatePath("/admin/students");
    revalidatePath("/admin/registrations");

    return { success: true, studentId: newStudent.id };
  } catch (err) {
    logger.error("[students] Failed to create student", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Review Registration Action ───────────────────────────────────────────────

export async function reviewRegistrationAction(
  _prevState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "registrations:review")) {
    return { message: "You do not have permission to review registrations." };
  }

  const parsed = ReviewRegistrationSchema.safeParse({
    registrationId: formData.get("registrationId"),
    action: formData.get("action"),
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { registrationId, action, remarks } = parsed.data;
  const newStatus = action === "approve" ? "approved" : "rejected";

  try {
    await db
      .update(registrations)
      .set({
        status: newStatus,
        remarks: remarks ?? null,
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(registrations.id, registrationId));

    await audit(
      session.userId,
      session.role,
      `registration_${newStatus}`,
      "registrations",
      registrationId,
      { status: newStatus, remarks }
    );

    logger.info("[registrations] Registration reviewed", {
      registrationId,
      newStatus,
      actorId: session.userId,
    });

    revalidatePath("/admin/registrations");
    revalidatePath("/admin/students");

    return { success: true, message: `Registration ${newStatus} successfully.` };
  } catch (err) {
    logger.error("[registrations] Failed to review", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
