"use server";

import { revalidatePath } from "next/cache";
import { hash, compare } from "bcryptjs";
import { db } from "@/lib/db";
import { portalAccounts, students } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireStaffSession, getCurrentSession, deleteSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction } from "@/lib/utils/audit-logger";
import { generatePortalPassword } from "@/features/students/students-portal.utils";
import { logger } from "@/lib/observability/logger";
import {
  isPasswordChangeRateLimited,
  getPasswordChangeResetSeconds,
  resetPasswordChangeRateLimit,
} from "@/lib/security/rateLimit";
import {
  createPortalAccountSchema,
  resetPortalPasswordSchema,
  togglePortalAccountStatusSchema,
  changePortalPasswordSchema,
  type CreatePortalAccountFormState,
  type ResetPortalPasswordFormState,
  type TogglePortalAccountStatusFormState,
  type ChangePortalPasswordFormState,
} from "./portal-accounts.schema";

// SECURITY (A-6): bcrypt cost factor - matches auth.actions.ts
const BCRYPT_COST = 12;

// ─── Create Portal Account ─────────────────────────────────────────────────────

/**
 * Create a portal account for an existing student.
 * The initial password is the student's DOB in YYYYMMDD format.
 */
export async function createPortalAccountAction(
  _prevState: CreatePortalAccountFormState,
  formData: FormData
): Promise<CreatePortalAccountFormState> {
  // 1. Auth check (staff-only)
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "portal_accounts:manage")) {
    return { message: "You do not have permission to create portal accounts." };
  }

  // 2. Validate input
  const parsed = createPortalAccountSchema.safeParse({
    studentId: formData.get("studentId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { studentId } = parsed.data;

  // 3. Get student data for password generation
  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), isNull(students.deletedAt)),
    columns: {
      id: true,
      referenceNumber: true,
      dateOfBirth: true,
      email: true,
      isActive: true,
    },
  });

  if (!student) {
    return { message: "Student not found." };
  }

  if (!student.isActive) {
    return { message: "Cannot create portal account for inactive student." };
  }

  // 4. Check if account already exists
  const existingAccount = await db.query.portalAccounts.findFirst({
    where: and(
      eq(portalAccounts.studentId, studentId),
      isNull(portalAccounts.deletedAt)
    ),
    columns: { id: true },
  });

  if (existingAccount) {
    return { message: "Portal account already exists for this student." };
  }

  // 5. Generate password from DOB
  const initialPassword = generatePortalPassword(
    student.dateOfBirth,
    student.referenceNumber
  );
  const passwordHash = await hash(initialPassword, BCRYPT_COST);

  // 6. Create portal account
  try {
    const [account] = await db
      .insert(portalAccounts)
      .values({
        studentId,
        username: student.referenceNumber,
        passwordHash,
        email: student.email,
        isActive: true,
        forcePasswordChange: true,
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: portalAccounts.id });

    // 7. Audit log
    await logCreateAction(session, "portal_accounts", account.id, {
      studentId,
      username: student.referenceNumber,
    });

    revalidatePath(`/staff/students/${studentId}`);

    return {
      success: true,
      accountId: account.id,
      initialPassword, // Return for display to user
    };
  } catch (error) {
    logger.error("[portal-accounts] Failed to create portal account", { error, studentId });
    return { message: "Failed to create portal account. Please try again." };
  }
}

// ─── Reset Portal Password ─────────────────────────────────────────────────────

/**
 * Reset a portal account password to the student's DOB.
 * Forces password change on next login.
 */
export async function resetPortalPasswordAction(
  _prevState: ResetPortalPasswordFormState,
  formData: FormData
): Promise<ResetPortalPasswordFormState> {
  // 1. Auth check (staff-only)
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "portal_accounts:reset_password")) {
    return { message: "You do not have permission to reset portal passwords." };
  }

  // 2. Validate input
  const parsed = resetPortalPasswordSchema.safeParse({
    portalAccountId: formData.get("portalAccountId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { portalAccountId } = parsed.data;

  // 3. Get account with student data
  const account = await db.query.portalAccounts.findFirst({
    where: and(
      eq(portalAccounts.id, portalAccountId),
      isNull(portalAccounts.deletedAt)
    ),
    columns: { id: true, studentId: true },
    with: {
      student: {
        columns: {
          referenceNumber: true,
          dateOfBirth: true,
        },
      },
    },
  });

  if (!account) {
    return { message: "Portal account not found." };
  }

  // 4. Generate new password from DOB
  const newPassword = generatePortalPassword(
    account.student.dateOfBirth,
    account.student.referenceNumber
  );
  const passwordHash = await hash(newPassword, BCRYPT_COST);

  // 5. Update password
  try {
    await db
      .update(portalAccounts)
      .set({
        passwordHash,
        forcePasswordChange: true,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(portalAccounts.id, portalAccountId));

    // 6. Audit log
    await logUpdateAction(session, "portal_accounts", portalAccountId, {}, {
      passwordReset: true,
    });

    revalidatePath(`/staff/students/${account.studentId}`);

    return {
      success: true,
      newPassword, // Return for display to user
    };
  } catch (error) {
    logger.error("[portal-accounts] Failed to reset portal password", { error, portalAccountId });
    return { message: "Failed to reset password. Please try again." };
  }
}

// ─── Toggle Portal Account Status ───────────────────────────────────────────────

/**
 * Activate or deactivate a portal account.
 */
export async function togglePortalAccountStatusAction(
  _prevState: TogglePortalAccountStatusFormState,
  formData: FormData
): Promise<TogglePortalAccountStatusFormState> {
  // 1. Auth check (staff-only)
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "portal_accounts:manage")) {
    return { message: "You do not have permission to manage portal accounts." };
  }

  // 2. Validate input
  const parsed = togglePortalAccountStatusSchema.safeParse({
    portalAccountId: formData.get("portalAccountId"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { portalAccountId, isActive } = parsed.data;

  // 3. Get account
  const account = await db.query.portalAccounts.findFirst({
    where: and(
      eq(portalAccounts.id, portalAccountId),
      isNull(portalAccounts.deletedAt)
    ),
    columns: { id: true, studentId: true, isActive: true },
  });

  if (!account) {
    return { message: "Portal account not found." };
  }

  // 4. Update status
  try {
    await db
      .update(portalAccounts)
      .set({
        isActive,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(portalAccounts.id, portalAccountId));

    // 5. Audit log
    await logUpdateAction(session, "portal_accounts", portalAccountId, {
      isActive: account.isActive,
    }, {
      isActive,
    });

    revalidatePath(`/staff/students/${account.studentId}`);

    return { success: true };
  } catch (error) {
    logger.error("[portal-accounts] Failed to toggle portal account status", { error, portalAccountId });
    return { message: "Failed to update account status. Please try again." };
  }
}

// ─── Change Portal Password (Portal User) ───────────────────────────────────────

/**
 * Allow portal users to change their own password.
 * Used during forced password change flow after first login.
 */
export async function changePortalPasswordAction(
  _prevState: ChangePortalPasswordFormState,
  formData: FormData
): Promise<ChangePortalPasswordFormState> {
  // 1. Get current session (must be portal session)
  const session = await getCurrentSession();
  if (!session || session.accountSource !== "portal" || !session.portalAccountId) {
    return { message: "You must be logged in as a portal user to change your password." };
  }

  // 2. Rate limit check - prevent brute force from compromised sessions
  if (isPasswordChangeRateLimited(session.portalAccountId)) {
    const resetSeconds = getPasswordChangeResetSeconds(session.portalAccountId);
    const resetMinutes = Math.ceil(resetSeconds / 60);
    return {
      message: `Too many password change attempts. Please try again in ${resetMinutes} minute${resetMinutes !== 1 ? "s" : ""}.`,
    };
  }

  // 3. Validate input
  const parsed = changePortalPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { currentPassword, newPassword } = parsed.data;

  // 4. Get account
  const account = await db.query.portalAccounts.findFirst({
    where: eq(portalAccounts.id, session.portalAccountId),
    columns: { id: true, passwordHash: true },
  });

  if (!account) {
    return { message: "Portal account not found." };
  }

  // 5. Verify current password
  const isCurrentPasswordValid = await compare(currentPassword, account.passwordHash);
  if (!isCurrentPasswordValid) {
    return { errors: { currentPassword: ["Current password is incorrect."] } };
  }

  // 6. Hash and save new password
  try {
    const newPasswordHash = await hash(newPassword, BCRYPT_COST);

    await db
      .update(portalAccounts)
      .set({
        passwordHash: newPasswordHash,
        forcePasswordChange: false,
        updatedAt: new Date(),
      })
      .where(eq(portalAccounts.id, session.portalAccountId));

    // 7. Audit log (use portalAccountId as actor since it's a self-service action)
    await logUpdateAction(
      { id: session.portalAccountId, role: "student" },
      "portal_accounts",
      session.portalAccountId,
      { forcePasswordChange: true },
      { forcePasswordChange: false }
    );

    // 8. Reset rate limit on successful password change
    resetPasswordChangeRateLimit(session.portalAccountId);

    // 9. Delete session - user will need to log in with new password
    await deleteSession();
  } catch (error) {
    logger.error("[portal-accounts] Failed to change portal password", {
      error,
      portalAccountId: session.portalAccountId,
    });
    return { message: "Failed to change password. Please try again." };
  }

  // 10. Redirect to login (must be outside try/catch as redirect throws)
  redirect("/login?message=password_changed");
}

// ─── Inline Account Creation (for student creation flow) ───────────────────────

/**
 * Create a portal account for a student in a transaction.
 * Called from createStudentAction to create account in same transaction.
 *
 * @param tx - Database transaction
 * @param studentId - Student ID
 * @param referenceNumber - Student reference number (becomes username)
 * @param dateOfBirth - Student DOB for password generation
 * @param email - Student email (optional)
 * @param createdBy - User who created the account
 * @returns Created account ID
 */
export async function createPortalAccountInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  studentId: string,
  referenceNumber: string,
  dateOfBirth: Date | null,
  email: string | null | undefined,
  createdBy: string
): Promise<string> {
  const initialPassword = generatePortalPassword(dateOfBirth, referenceNumber);
  const passwordHash = await hash(initialPassword, BCRYPT_COST);

  const [account] = await tx
    .insert(portalAccounts)
    .values({
      studentId,
      username: referenceNumber,
      passwordHash,
      email: email ?? null,
      isActive: true,
      forcePasswordChange: true,
      createdBy,
      updatedBy: createdBy,
    })
    .returning({ id: portalAccounts.id });

  return account.id;
}
