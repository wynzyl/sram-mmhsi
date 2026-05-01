"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  students,
  parentsGuardians,
  studentGuardianLinks,
  auditLogs,
  enrollments,
} from "@/lib/db/schema";
import { eq, ilike, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { CreateStudentSchema, UpdateStudentSchema } from "@/lib/validators/student";
import type { CreateStudentFormState, UpdateStudentFormState } from "@/lib/validators/student";
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

    // NEW FIELDS:
    lrn: formData.get("lrn") || undefined,
    mobileNumber: formData.get("mobileNumber") || undefined,
    email: formData.get("email") || undefined,
    nationality: formData.get("nationality") || undefined,
    bloodType: formData.get("bloodType") || undefined,
    religion: formData.get("religion") || undefined,
    previousSchool: formData.get("previousSchool") || undefined,
    submittedDocumentsNotes: formData.get("submittedDocumentsNotes") || undefined,

    guardians: guardiansParsed,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as CreateStudentFormState["errors"] };
  }

  const { guardians, ...studentData } = parsed.data;

  // 4. Duplicate detection — always runs.
  // Base match: same first + last name on an active record.
  // Tightened by middleName when provided, and by dateOfBirth when provided.
  {
    const conditions = [
      ilike(students.firstName, studentData.firstName),
      ilike(students.lastName, studentData.lastName),
      eq(students.isActive, true),
    ];
    if (studentData.middleName) {
      conditions.push(ilike(students.middleName, studentData.middleName));
    }
    if (studentData.dateOfBirth) {
      conditions.push(eq(students.dateOfBirth, studentData.dateOfBirth));
    }

    const existing = await db
      .select({
        id: students.id,
        referenceNumber: students.referenceNumber,
      })
      .from(students)
      .where(and(...conditions))
      .limit(1);

    if (existing.length > 0) {
      const fullName = `${studentData.firstName} ${studentData.lastName}`;
      const ref = existing[0].referenceNumber;
      const message = studentData.dateOfBirth
        ? `A student named ${fullName} with this date of birth already exists (Ref: ${ref}).`
        : `A student named ${fullName} already exists (Ref: ${ref}). Provide a date of birth to disambiguate, or update the existing record instead.`;
      return { errors: { _form: [message] } };
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
          address: guardian.address,
          occupation: guardian.occupation,
          contactNumber: guardian.contactNumber,
          email: guardian.email,
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

    // 8. Audit log
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

// ─── Update Student Action ────────────────────────────────────────────────────

export async function updateStudentAction(
  _prevState: UpdateStudentFormState,
  formData: FormData
): Promise<UpdateStudentFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "students:update")) {
    return { message: "You do not have permission to update students." };
  }

  // 2. Parse raw form data — guardians come in as JSON string from the client
  const guardiansRaw = formData.get("guardians");
  let guardiansParsed: unknown[] = [];
  try {
    guardiansParsed = JSON.parse(guardiansRaw as string);
  } catch {
    return { errors: { guardians: ["Guardian data is malformed."] } };
  }

  const isActiveRaw = formData.get("isActive");

  // 3. Validate
  const parsed = UpdateStudentSchema.safeParse({
    studentId: formData.get("studentId"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || undefined,
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    gender: formData.get("gender") || undefined,
    address: formData.get("address") || undefined,

    // NEW FIELDS:
    lrn: formData.get("lrn") || undefined,
    mobileNumber: formData.get("mobileNumber") || undefined,
    email: formData.get("email") || undefined,
    nationality: formData.get("nationality") || undefined,
    bloodType: formData.get("bloodType") || undefined,
    religion: formData.get("religion") || undefined,
    previousSchool: formData.get("previousSchool") || undefined,
    submittedDocumentsNotes: formData.get("submittedDocumentsNotes") || undefined,

    isActive: isActiveRaw === "on" || isActiveRaw === "true",
    guardians: guardiansParsed,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as UpdateStudentFormState["errors"] };
  }

  const { studentId, guardians, isActive, ...studentData } = parsed.data;

  // 4. Check if student exists
  const existingStudent = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!existingStudent) {
    return { message: "Student not found." };
  }

  const hasEnrolledEnrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, "enrolled")
    ),
    columns: { id: true },
  });

  if (hasEnrolledEnrollment && isActive !== existingStudent.isActive) {
    return {
      errors: {
        isActive: [
          "Active status cannot be changed while this student has an enrollment in Enrolled status.",
        ],
      },
    };
  }

  // 5. Duplicate detection — always runs, excluding the current student.
  // Base match: same first + last name on an active record (other than self).
  // Tightened by middleName when provided, and by dateOfBirth when provided.
  {
    const conditions = [
      ilike(students.firstName, studentData.firstName),
      ilike(students.lastName, studentData.lastName),
      eq(students.isActive, true),
      sql`${students.id} != ${studentId}`,
    ];
    if (studentData.middleName) {
      conditions.push(ilike(students.middleName, studentData.middleName));
    }
    if (studentData.dateOfBirth) {
      conditions.push(eq(students.dateOfBirth, studentData.dateOfBirth));
    }

    const existing = await db
      .select({
        id: students.id,
        referenceNumber: students.referenceNumber,
      })
      .from(students)
      .where(and(...conditions))
      .limit(1);

    if (existing.length > 0) {
      const fullName = `${studentData.firstName} ${studentData.lastName}`;
      const ref = existing[0].referenceNumber;
      const message = studentData.dateOfBirth
        ? `Another student named ${fullName} with this date of birth already exists (Ref: ${ref}).`
        : `Another student named ${fullName} already exists (Ref: ${ref}). Provide a date of birth to disambiguate.`;
      return { errors: { _form: [message] } };
    }
  }

  try {
    // 6. Update student
    await db
      .update(students)
      .set({
        ...studentData,
        isActive: isActive !== undefined ? isActive : existingStudent.isActive,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId));

    // 7. Update guardians: Delete existing links and recreate
    // We only delete links; we don't delete guardians to avoid orphaned data errors,
    // though in a real system we might clean them up if they have no other links.
    await db.delete(studentGuardianLinks).where(eq(studentGuardianLinks.studentId, studentId));

    for (const guardian of guardians) {
      const [newGuardian] = await db
        .insert(parentsGuardians)
        .values({
          firstName: guardian.firstName,
          middleName: guardian.middleName,
          lastName: guardian.lastName,
          relationship: guardian.relationship,
          address: guardian.address,
          occupation: guardian.occupation,
          contactNumber: guardian.contactNumber,
          email: guardian.email,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: parentsGuardians.id });

      await db.insert(studentGuardianLinks).values({
        studentId,
        guardianId: newGuardian.id,
        isPrimary: guardian.isPrimary ?? false,
      });
    }

    // 8. Audit log
    await audit(
      session.userId,
      session.role,
      "student_updated",
      "students",
      studentId,
      { firstName: studentData.firstName, lastName: studentData.lastName, isActive }
    );

    logger.info("[students] Student updated", {
      studentId,
      actorId: session.userId,
    });

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (err) {
    logger.error("[students] Failed to update student", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
