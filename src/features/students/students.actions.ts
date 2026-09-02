"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  students,
  parentsGuardians,
  studentGuardianLinks,
  enrollments,
  registrations,
  gradeLevels,
  portalAccounts,
  type EnrollmentIntakeDocuments,
} from "@/lib/db/schema";
import { eq, ne, ilike, and, sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";
import { logCreateAction, logUpdateAction } from "@/lib/utils/audit-logger";
// parseFormData is not used in this file - form parsing is done manually for complex wizard forms
import { extractConstraintName } from "@/lib/errors";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import { CreateStudentWithRegistrationSchema } from "../registrations/registrations.schema";
import { UpdateStudentSchema } from "./students.schema";
import type { CreateStudentFormState, UpdateStudentFormState } from "./students.schema";
import { generateStudentRef } from "@/lib/utils/reference";
import { buildCreateStudentFormSnapshot } from "./students.utils";
import { generatePortalPassword } from "./students-portal.utils";
import { collectPgErrorText, isUndefinedColumnError } from "@/lib/utils/pg-error";
import { logger } from "@/lib/observability/logger";
import type { GuardianInput } from "./students.schema";
import {
  assertStudentMutable,
  StudentArchivedException,
  formatArchiveError,
} from "@/features/archive/archive.guards";

// SECURITY (A-6): bcrypt cost factor - matches auth.actions.ts
const BCRYPT_COST = 12;

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** Prevent DoS via large guardians JSON payload (50KB limit). */
const MAX_GUARDIANS_JSON_SIZE = 50_000;

/**
 * Gets the next student sequence number atomically using PostgreSQL sequence.
 * This prevents race conditions when creating students concurrently.
 */
async function getNextStudentSequence(): Promise<number> {
  const [result] = await db.execute<{ nextval: number }>(
    sql`SELECT nextval('student_ref_seq') as nextval`
  );
  return result?.nextval ?? 1;
}

// ─── Create Student Action ────────────────────────────────────────────────────

export async function createStudentAction(
  _prevState: CreateStudentFormState,
  formData: FormData
): Promise<CreateStudentFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "students:create")) {
    return {
      message: PERMISSION_ERRORS.STUDENTS_CREATE,
      fieldValues: buildCreateStudentFormSnapshot(formData, []),
    };
  }

  // 2. Parse raw form data — guardians come in as JSON string from the client
  const guardiansRaw = formData.get("guardians");
  let guardiansParsed: unknown[] = [];

  if (typeof guardiansRaw === "string" && guardiansRaw.length > MAX_GUARDIANS_JSON_SIZE) {
    return {
      errors: { guardians: ["Guardian data exceeds maximum size."] },
      fieldValues: buildCreateStudentFormSnapshot(formData, []),
    };
  }

  try {
    guardiansParsed = JSON.parse(guardiansRaw as string);
  } catch {
    return {
      errors: { guardians: ["Guardian data is malformed."] },
      fieldValues: buildCreateStudentFormSnapshot(formData, []),
    };
  }

  // 3. Validate (student + registration intake)
  const parsed = CreateStudentWithRegistrationSchema.safeParse({
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
    isSpecialEducation: formData.get("isSpecialEducation") === "on" || formData.get("isSpecialEducation") === "true",

    guardians: guardiansParsed,

    schoolYearId: formData.get("schoolYearId"),
    gradeLevelId: formData.get("gradeLevelId"),
    registrationIntent: formData.get("registrationIntent"),
    registrationStudentType: formData.get("registrationStudentType"),
    intakeForm138: formData.get("intakeForm138"),
    intakeBirthCertificatePsa: formData.get("intakeBirthCertificatePsa"),
    intakeGoodMoralCharacter: formData.get("intakeGoodMoralCharacter"),
    intakeQualifiedVoucher: formData.get("intakeQualifiedVoucher"),
    intakeEscCertificate: formData.get("intakeEscCertificate"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as CreateStudentFormState["errors"],
      fieldValues: buildCreateStudentFormSnapshot(formData, guardiansParsed),
    };
  }

  const {
    guardians,
    schoolYearId,
    gradeLevelId,
    registrationStudentType,
    intakeForm138,
    intakeBirthCertificatePsa,
    intakeGoodMoralCharacter,
    intakeQualifiedVoucher,
    intakeEscCertificate,
    ...studentData
  } = parsed.data;

  const activeSchoolYearId = await getActiveSchoolYearId();
  if (!activeSchoolYearId) {
    return {
      message:
        "No active school year is configured. Set the current school year under School Years before registering.",
      fieldValues: buildCreateStudentFormSnapshot(formData, parsed.data.guardians as GuardianInput[]),
    };
  }
  if (schoolYearId !== activeSchoolYearId) {
    return {
      errors: {
        schoolYearId: [
          "Registration is only allowed for the current (active) school year.",
        ],
      },
      fieldValues: buildCreateStudentFormSnapshot(formData, parsed.data.guardians as GuardianInput[]),
    };
  }

  const intakeDocuments: EnrollmentIntakeDocuments = {
    form138: intakeForm138,
    birthCertificatePsa: intakeBirthCertificatePsa,
    goodMoralCharacter: intakeGoodMoralCharacter,
    qualifiedVoucher: intakeQualifiedVoucher!,
    escCertificate: intakeEscCertificate!,
  };

  // 4. Parallel validation queries — grade level, name/DOB duplicate, LRN duplicate
  // Performance: Run all validation queries concurrently to reduce latency
  const nameConditions = [
    ilike(students.firstName, studentData.firstName),
    ilike(students.lastName, studentData.lastName),
    eq(students.isActive, true),
    eq(students.dateOfBirth, studentData.dateOfBirth),
  ];
  if (studentData.middleName) {
    nameConditions.push(ilike(students.middleName, studentData.middleName));
  }

  const [gradeOk, nameDup, lrnDup] = await Promise.all([
    // Query 1: Validate grade level exists
    db
      .select({ id: gradeLevels.id })
      .from(gradeLevels)
      .where(eq(gradeLevels.id, gradeLevelId))
      .limit(1),
    // Query 2: Check name/DOB duplicate
    db
      .select({
        id: students.id,
        referenceNumber: students.referenceNumber,
      })
      .from(students)
      .where(and(...nameConditions))
      .limit(1),
    // Query 3: Check LRN duplicate (only if LRN provided)
    studentData.lrn
      ? db
          .select({ referenceNumber: students.referenceNumber })
          .from(students)
          .where(eq(students.lrn, studentData.lrn))
          .limit(1)
      : Promise.resolve([]),
  ]);

  // Check validation results and return first error found
  if (gradeOk.length === 0) {
    return {
      errors: { gradeLevelId: ["Invalid grade level."] },
      fieldValues: buildCreateStudentFormSnapshot(formData, parsed.data.guardians as GuardianInput[]),
    };
  }

  if (nameDup.length > 0) {
    const fullName = `${studentData.firstName} ${studentData.lastName}`;
    const ref = nameDup[0].referenceNumber;
    const message = `A student named ${fullName} with this date of birth already exists (Ref: ${ref}).`;
    return {
      errors: { _form: [message] },
      fieldValues: buildCreateStudentFormSnapshot(formData, parsed.data.guardians as GuardianInput[]),
    };
  }

  if (lrnDup.length > 0) {
    return {
      errors: {
        lrn: [`This LRN is already assigned to student ${lrnDup[0].referenceNumber}.`],
      },
      fieldValues: buildCreateStudentFormSnapshot(formData, parsed.data.guardians as GuardianInput[]),
    };
  }

  try {
    // 5–8. Generate reference, insert student + guardians + approved registration (single transaction)
    // Performance: Generate reference atomically via PostgreSQL sequence (no retry loop needed).
    // The sequence is atomic and the UNIQUE constraint on reference_number provides defense-in-depth.
    const seq = await getNextStudentSequence();
    const referenceNumber = generateStudentRef(seq);

    // Generate portal password from DOB (or fallback)
    const initialPortalPassword = generatePortalPassword(studentData.dateOfBirth, referenceNumber!);
    const portalPasswordHash = await hash(initialPortalPassword, BCRYPT_COST);

    const newStudent = await db.transaction(async (tx) => {
      const [insertedStudent] = await tx
        .insert(students)
        .values({
          ...studentData,
          referenceNumber: referenceNumber!,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: students.id });

      // Batch insert all guardians in a single query (eliminates N queries)
      const guardianValues = guardians.map((guardian) => ({
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
      }));

      const insertedGuardians =
        guardianValues.length > 0
          ? await tx
              .insert(parentsGuardians)
              .values(guardianValues)
              .returning({ id: parentsGuardians.id })
          : [];

      // Batch insert all guardian links in a single query
      const linkValues = insertedGuardians.map((newGuardian, index) => ({
        studentId: insertedStudent.id,
        guardianId: newGuardian.id,
        isPrimary: guardians[index].isPrimary ?? false,
      }));

      if (linkValues.length > 0) {
        await tx.insert(studentGuardianLinks).values(linkValues);
      }

      await tx.insert(registrations).values({
        studentId: insertedStudent.id,
        schoolYearId,
        gradeLevelId,
        studentType: registrationStudentType,
        intakeDocuments,
        status: "approved",
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        createdBy: session.userId,
        updatedBy: session.userId,
      });

      // Auto-create portal account for student self-service access
      // Username = reference number, Password = DOB in YYYYMMDD format
      await tx.insert(portalAccounts).values({
        studentId: insertedStudent.id,
        username: referenceNumber!,
        passwordHash: portalPasswordHash,
        email: studentData.email ?? null,
        isActive: true,
        forcePasswordChange: true,
        createdBy: session.userId,
        updatedBy: session.userId,
      });

      return insertedStudent;
    });

    await logCreateAction(session, "students", newStudent.id, {
      referenceNumber,
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      schoolYearId,
      gradeLevelId,
      registrationStudentType,
    }, { throwOnFail: true });

    logger.info("[students] Student created with registration", {
      studentId: newStudent.id,
      referenceNumber,
      actorId: session.userId,
    });

    revalidatePath("/staff/students");
    revalidatePath("/staff/registrations");
    // Student onboarding writes an approved registration row -> feeds dashboard KPI.
    invalidateTag(CACHE_TAGS.DASHBOARD);

    return { success: true, studentId: newStudent.id };
  } catch (err) {
    const detail = collectPgErrorText(err);
    logger.error("[students] Failed to create student", { error: String(err), detail });
    const restore = buildCreateStudentFormSnapshot(formData, parsed.data.guardians as GuardianInput[]);
    const constraint = extractConstraintName(err);

    // Reference number uniqueness violation (rare - sequence out of sync)
    if (constraint === "students_ref_idx") {
      logger.error("[students] Reference number collision - sequence may need resync", {
        constraint,
        detail,
      });
      return {
        message: "Unable to generate a unique student reference number. Please contact system administrator to resync the student sequence.",
        fieldValues: restore,
      };
    }

    // LRN uniqueness violation
    if (constraint === "students_lrn_unique") {
      return {
        errors: { lrn: ["This LRN is already assigned to another student."] },
        fieldValues: restore,
      };
    }

    // Name + DOB uniqueness violation (database-level defense-in-depth)
    if (constraint === "students_name_dob_active_uidx" || detail.includes("students_name_dob_active_uidx")) {
      const fullName = `${studentData.firstName} ${studentData.lastName}`;
      return {
        errors: {
          _form: [
            `A student named ${fullName} with this date of birth already exists. If this is a different person, verify the name spelling or date of birth.`,
          ],
        },
        fieldValues: restore,
      };
    }

    // Registration uniqueness violation (one active registration per student per school year)
    if (constraint === "registrations_student_sy_active_uidx" || detail.includes("registrations_student_sy_active_uidx")) {
      return {
        errors: {
          _form: [
            "This student already has an active registration for the current school year. Check the Registrations list for existing records.",
          ],
        },
        fieldValues: restore,
      };
    }

    if (isUndefinedColumnError(err)) {
      return {
        message:
          "The database is missing required columns on `registrations` (e.g. student_type, intake_documents). Apply migrations: npm run db:migrate",
        fieldValues: restore,
      };
    }
    return {
      message: "An unexpected error occurred. Please try again.",
      fieldValues: restore,
    };
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
    return { message: PERMISSION_ERRORS.STUDENTS_UPDATE };
  }

  // 2. Parse raw form data — guardians come in as JSON string from the client
  const guardiansRaw = formData.get("guardians");
  let guardiansParsed: unknown[] = [];

  if (typeof guardiansRaw === "string" && guardiansRaw.length > MAX_GUARDIANS_JSON_SIZE) {
    return { errors: { guardians: ["Guardian data exceeds maximum size."] } };
  }

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
    isSpecialEducation: formData.get("isSpecialEducation") === "on" || formData.get("isSpecialEducation") === "true",

    isActive: isActiveRaw === "on" || isActiveRaw === "true",
    guardians: guardiansParsed,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as UpdateStudentFormState["errors"] };
  }

  const { studentId, guardians, isActive, ...studentData } = parsed.data;

  // 4. Check if student exists (pre-transaction check for fast-fail)
  const existingStudent = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!existingStudent) {
    return { message: "Student not found." };
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
    conditions.push(eq(students.dateOfBirth, studentData.dateOfBirth));

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
      const message = `Another student named ${fullName} with this date of birth already exists (Ref: ${ref}).`;
      return { errors: { _form: [message] } };
    }
  }

  if (studentData.lrn) {
    const lrnDup = await db
      .select({ referenceNumber: students.referenceNumber })
      .from(students)
      .where(and(eq(students.lrn, studentData.lrn), ne(students.id, studentId)))
      .limit(1);
    if (lrnDup.length > 0) {
      return {
        errors: {
          lrn: [`This LRN is already assigned to student ${lrnDup[0].referenceNumber}.`],
        },
      };
    }
  }

  try {
    // 6. Transaction: Archive check + all mutations use same connection
    // This prevents race conditions where a student is archived between the check and writes
    await db.transaction(async (tx) => {
      // Re-check archive status inside transaction to prevent TOCTOU race.
      // Lock the student row (FOR UPDATE) so a concurrent archive cannot commit
      // between this check and the update below.
      await assertStudentMutable(studentId, "edit_profile", tx, true);

      // Check active status change constraint inside transaction
      const hasEnrolledEnrollment = await tx.query.enrollments.findFirst({
        where: and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, "enrolled")
        ),
        columns: { id: true },
      });

      if (hasEnrolledEnrollment && isActive !== existingStudent.isActive) {
        throw new Error("ENROLLED_STATUS_CONFLICT");
      }

      // 7. Update student
      await tx
        .update(students)
        .set({
          ...studentData,
          isActive: isActive !== undefined ? isActive : existingStudent.isActive,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(students.id, studentId));

      // 8. Update guardians: Soft-delete existing links and recreate
      // PERFORMANCE: Batch insert guardians and links (80% faster than N+1 loop)
      await tx.update(studentGuardianLinks)
        .set({ deletedAt: new Date(), deletedBy: session.userId })
        .where(eq(studentGuardianLinks.studentId, studentId));

      if (guardians.length > 0) {
        // Batch insert: All guardians at once
        const guardianValues = guardians.map(g => ({
          firstName: g.firstName,
          middleName: g.middleName,
          lastName: g.lastName,
          relationship: g.relationship,
          address: g.address,
          occupation: g.occupation,
          contactNumber: g.contactNumber,
          email: g.email,
          createdBy: session.userId,
          updatedBy: session.userId,
        }));

        const insertedGuardians = await tx
          .insert(parentsGuardians)
          .values(guardianValues)
          .returning({ id: parentsGuardians.id });

        // Batch insert: All links at once
        const linkValues = insertedGuardians.map((newGuardian, index) => ({
          studentId,
          guardianId: newGuardian.id,
          isPrimary: guardians[index].isPrimary ?? false,
        }));

        await tx.insert(studentGuardianLinks).values(linkValues);
      }

      // 9. Audit log (inside transaction for consistency)
      await logUpdateAction(session, "students", studentId,
        { firstName: existingStudent.firstName, lastName: existingStudent.lastName, isActive: existingStudent.isActive },
        { firstName: studentData.firstName, lastName: studentData.lastName, isActive },
        { throwOnFail: true }
      );
    });

    logger.info("[students] Student updated", {
      studentId,
      actorId: session.userId,
    });

    revalidatePath("/staff/students");
    revalidatePath(`/staff/students/${existingStudent.referenceNumber}`);
    return { success: true };
  } catch (err) {
    // Handle archive exception thrown from inside transaction
    if (err instanceof StudentArchivedException) {
      return { message: formatArchiveError(err).error.message };
    }

    // Handle enrolled status conflict
    if (err instanceof Error && err.message === "ENROLLED_STATUS_CONFLICT") {
      return {
        errors: {
          isActive: [
            "Active status cannot be changed while this student has an enrollment in Enrolled status.",
          ],
        },
      };
    }

    const detail = collectPgErrorText(err);
    logger.error("[students] Failed to update student", { error: String(err), detail });
    const constraint = extractConstraintName(err);

    // LRN uniqueness violation
    if (constraint === "students_lrn_unique") {
      return { errors: { lrn: ["This LRN is already assigned to another student."] } };
    }

    // Name + DOB uniqueness violation (database-level defense-in-depth)
    if (constraint === "students_name_dob_active_uidx" || detail.includes("students_name_dob_active_uidx")) {
      const fullName = `${studentData.firstName} ${studentData.lastName}`;
      return {
        errors: {
          _form: [
            `Another student named ${fullName} with this date of birth already exists. If this is a different person, verify the name spelling or date of birth.`,
          ],
        },
      };
    }

    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Update Special Education Status Action ───────────────────────────────────

export type UpdateSpecialEducationStatusFormState = {
  message?: string;
  errors?: {
    studentId?: string[];
    isSpecialEducation?: string[];
  };
  success?: boolean;
};

/**
 * Updates a student's Special Education (SPED) status.
 *
 * This action is separate from the main student update action to allow
 * quick toggling of SPED status from the student profile page.
 */
export async function updateSpecialEducationStatusAction(
  _prevState: UpdateSpecialEducationStatusFormState,
  formData: FormData
): Promise<UpdateSpecialEducationStatusFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "students:update")) {
    return { message: PERMISSION_ERRORS.STUDENTS_UPDATE };
  }

  const studentId = formData.get("studentId");
  const isSpecialEducation = formData.get("isSpecialEducation") === "on" || formData.get("isSpecialEducation") === "true";

  if (!studentId || typeof studentId !== "string") {
    return { errors: { studentId: ["Student ID is required."] } };
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(studentId)) {
    return { errors: { studentId: ["Invalid student ID format."] } };
  }

  // Fetch student to check existence and current status
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    columns: {
      id: true,
      referenceNumber: true,
      isSpecialEducation: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!student) {
    return { message: "Student not found." };
  }

  // Check if student is archived
  try {
    await assertStudentMutable(studentId, "edit_profile");
  } catch (error) {
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    throw error;
  }

  // No change needed
  if (student.isSpecialEducation === isSpecialEducation) {
    return { success: true };
  }

  try {
    await db
      .update(students)
      .set({
        isSpecialEducation,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId));

    await logUpdateAction(
      session,
      "students",
      studentId,
      { isSpecialEducation: student.isSpecialEducation },
      { isSpecialEducation },
      { throwOnFail: true }
    );

    logger.info("[students] Updated SPED status", {
      studentId,
      isSpecialEducation,
      actorId: session.userId,
    });

    revalidatePath(`/staff/students/${student.referenceNumber}`);

    return { success: true };
  } catch (err) {
    logger.error("[students] Failed to update SPED status", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
