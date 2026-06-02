"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, ilike, isNull, sql, count } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  ToggleUserStatusSchema,
} from "./users.schema";
import type {
  CreateUserFormState,
  UpdateUserFormState,
  ResetPasswordFormState,
  ToggleUserStatusFormState,
} from "./users.schema";
import { logger } from "@/lib/observability/logger";
import { isAdminActionRateLimited, getAdminActionResetSeconds } from "@/lib/security/rateLimit";
import { ROLES, type Role } from "@/lib/constants/roles";
import bcrypt from "bcryptjs";

// SECURITY (A-6): bcrypt cost factor - matches auth.actions.ts
const BCRYPT_COST = 12;

/**
 * SECURITY: Privilege-escalation guard for user management.
 *
 * Only a super_admin may create, grant, or modify a super_admin account.
 * Without this, any actor holding `users:manage` (notably `admin`) could mint a
 * super_admin, elevate their own role, or reset the super_admin's password and
 * take over the top-level account.
 *
 * @returns an error message if the action is forbidden, otherwise null.
 */
function assertSuperAdminAuthority(
  actorRole: Role,
  opts: { targetRole?: Role; existingRole?: Role }
): string | null {
  if (actorRole === ROLES.SUPER_ADMIN) return null;
  if (
    opts.targetRole === ROLES.SUPER_ADMIN ||
    opts.existingRole === ROLES.SUPER_ADMIN
  ) {
    return "Only a super administrator can create or modify super-admin accounts.";
  }
  return null;
}

// ─── Create User Action ───────────────────────────────────────────────────────

export async function createUserAction(
  _prevState: CreateUserFormState,
  formData: FormData
): Promise<CreateUserFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) {
    return { message: "You do not have permission to create users." };
  }

  // 1.1 Rate limit check (prevent abuse)
  if (isAdminActionRateLimited(session.userId)) {
    const resetSeconds = getAdminActionResetSeconds(session.userId);
    logger.warn("[users] Rate limit exceeded for user creation", {
      userId: session.userId,
    });
    return {
      message: `Too many requests. Please wait ${resetSeconds} second${resetSeconds !== 1 ? "s" : ""}.`,
    };
  }

  // 2. Validate
  const result = parseFormData(CreateUserSchema, formData, { booleanFields: ["forcePasswordChange"] });
  if (!result.success) {
    return { errors: result.errors };
  }

  const { password, ...userData } = result.data;

  // 2.1 SECURITY: prevent non-super_admin from creating a super_admin account
  const authError = assertSuperAdminAuthority(session.role, { targetRole: userData.role });
  if (authError) {
    logger.warn("[users] Blocked privileged role creation", {
      actorId: session.userId,
      actorRole: session.role,
      targetRole: userData.role,
    });
    return { message: authError };
  }

  // 3. Duplicate detection (PERFORMANCE: Single query checks both email and username)
  const duplicates = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
    })
    .from(users)
    .where(
      and(
        sql`(
          LOWER(${users.email}) = LOWER(${userData.email})
          OR LOWER(${users.username}) = LOWER(${userData.username})
        )`,
        isNull(users.deletedAt)
      )
    )
    .limit(2);

  const errors: Record<string, string[]> = {};

  for (const dup of duplicates) {
    if (dup.email.toLowerCase() === userData.email.toLowerCase()) {
      errors.email = ["This email is already in use."];
    }
    if (dup.username.toLowerCase() === userData.username.toLowerCase()) {
      errors.username = ["This username is already in use."];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    // 4. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // 5. Insert user
    const [newUser] = await db
      .insert(users)
      .values({
        ...userData,
        passwordHash,
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: users.id });

    // 6. Audit log
    await logCreateAction(session, "users", newUser.id, {
      email: userData.email,
      username: userData.username,
      role: userData.role,
    }, { throwOnFail: true });

    logger.info("[users] User created", {
      userId: newUser.id,
      email: userData.email,
      actorId: session.userId,
    });

    revalidatePath("/admin/users");

    return { success: true, userId: newUser.id };
  } catch (err) {
    logger.error("[users] Failed to create user", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Update User Action ───────────────────────────────────────────────────────

export async function updateUserAction(
  _prevState: UpdateUserFormState,
  formData: FormData
): Promise<UpdateUserFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) {
    return { message: "You do not have permission to update users." };
  }

  // 2. Validate
  const result = parseFormData(UpdateUserSchema, formData, { booleanFields: ["isActive"] });
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  const { userId, ...updateData } = parsed.data;

  // 3. Get existing user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!existingUser) {
    return { message: "User not found." };
  }

  // 3.1 SECURITY: prevent non-super_admin from modifying a super_admin account
  // or elevating any account to super_admin.
  const authError = assertSuperAdminAuthority(session.role, {
    targetRole: updateData.role,
    existingRole: existingUser.role,
  });
  if (authError) {
    logger.warn("[users] Blocked privileged role escalation", {
      actorId: session.userId,
      actorRole: session.role,
      targetUserId: userId,
      existingRole: existingUser.role,
      targetRole: updateData.role,
    });
    return { message: authError };
  }

  // 3.2 SECURITY: prevent self role-change (mirrors self-deactivation guard below)
  if (userId === session.userId && updateData.role !== existingUser.role) {
    return { errors: { role: ["You cannot change your own role."] } };
  }

  // 4. Duplicate detection (excluding current user)
  if (updateData.email && updateData.email !== existingUser.email) {
    const duplicateEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ilike(users.email, updateData.email),
          sql`${users.id} != ${userId}`,
          isNull(users.deletedAt)
        )
      )
      .limit(1);

    if (duplicateEmail.length > 0) {
      return {
        errors: {
          email: ["This email is already in use."],
        },
      };
    }
  }

  if (updateData.username && updateData.username !== existingUser.username) {
    const duplicateUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ilike(users.username, updateData.username),
          sql`${users.id} != ${userId}`,
          isNull(users.deletedAt)
        )
      )
      .limit(1);

    if (duplicateUsername.length > 0) {
      return {
        errors: {
          username: ["This username is already in use."],
        },
      };
    }
  }

  // 5. Prevent self-deactivation
  if (updateData.isActive === false && userId === session.userId) {
    return {
      errors: {
        isActive: ["You cannot deactivate your own account."],
      },
    };
  }

  // 6. Prevent deactivation of the last active privileged account
  if (
    updateData.isActive === false &&
    existingUser.isActive === true &&
    (existingUser.role === "admin" || existingUser.role === "super_admin")
  ) {
    const activePrivilegedCount = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.role, existingUser.role),
          eq(users.isActive, true),
          isNull(users.deletedAt)
        )
      );

    if ((activePrivilegedCount[0]?.count ?? 0) <= 1) {
      return {
        errors: {
          isActive: [
            existingUser.role === "super_admin"
              ? "Cannot deactivate the last active super administrator account."
              : "Cannot deactivate the last active administrator account.",
          ],
        },
      };
    }
  }

  try {
    // 7. Update user
    await db
      .update(users)
      .set({
        ...updateData,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 8. Audit log
    await logUpdateAction(
      session,
      "users",
      userId,
      {
        email: existingUser.email,
        username: existingUser.username,
        role: existingUser.role,
        isActive: existingUser.isActive,
      },
      updateData,
      { throwOnFail: true }
    );

    logger.info("[users] User updated", {
      userId,
      actorId: session.userId,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true };
  } catch (err) {
    logger.error("[users] Failed to update user", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Reset Password Action ────────────────────────────────────────────────────

export async function resetPasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData
): Promise<ResetPasswordFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) {
    return { message: "You do not have permission to reset passwords." };
  }

  // 2. Validate
  const result = parseFormData(ResetPasswordSchema, formData, { booleanFields: ["forcePasswordChange"] });
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  const { userId, newPassword, forcePasswordChange } = parsed.data;

  // 3. Check user exists
  const [existingUser] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!existingUser) {
    return { message: "User not found." };
  }

  // 3.1 SECURITY: prevent non-super_admin from resetting a super_admin's password
  // (account-takeover vector).
  const authError = assertSuperAdminAuthority(session.role, { existingRole: existingUser.role });
  if (authError) {
    logger.warn("[users] Blocked privileged password reset", {
      actorId: session.userId,
      actorRole: session.role,
      targetUserId: userId,
      existingRole: existingUser.role,
    });
    return { message: authError };
  }

  try {
    // 4. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    // 5. Update password
    await db
      .update(users)
      .set({
        passwordHash,
        forcePasswordChange,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 6. Audit log
    await logUpdateAction(
      session,
      "users",
      userId,
      {},
      { passwordReset: true, forcePasswordChange },
      { throwOnFail: true }
    );

    logger.info("[users] Password reset", {
      userId,
      actorId: session.userId,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, message: "Password reset successfully." };
  } catch (err) {
    logger.error("[users] Failed to reset password", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Toggle User Status Action ────────────────────────────────────────────────

export async function toggleUserStatusAction(
  _prevState: ToggleUserStatusFormState,
  formData: FormData
): Promise<ToggleUserStatusFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) {
    return { message: "You do not have permission to change user status." };
  }

  // 2. Validate
  const result = parseFormData(ToggleUserStatusSchema, formData, { booleanFields: ["isActive"] });
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  const { userId, isActive } = parsed.data;

  // 3. Get existing user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!existingUser) {
    return { message: "User not found." };
  }

  // 3.1 SECURITY: prevent non-super_admin from changing a super_admin's status
  const authError = assertSuperAdminAuthority(session.role, { existingRole: existingUser.role });
  if (authError) {
    logger.warn("[users] Blocked privileged status change", {
      actorId: session.userId,
      actorRole: session.role,
      targetUserId: userId,
      existingRole: existingUser.role,
    });
    return { message: authError };
  }

  // 4. Prevent self-deactivation
  if (isActive === false && userId === session.userId) {
    return {
      errors: {
        _form: ["You cannot deactivate your own account."],
      },
    };
  }

  // 5. Prevent deactivation of the last active privileged account
  if (
    isActive === false &&
    existingUser.isActive === true &&
    (existingUser.role === "admin" || existingUser.role === "super_admin")
  ) {
    const activePrivilegedCount = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.role, existingUser.role),
          eq(users.isActive, true),
          isNull(users.deletedAt)
        )
      );

    if ((activePrivilegedCount[0]?.count ?? 0) <= 1) {
      return {
        errors: {
          _form: [
            existingUser.role === "super_admin"
              ? "Cannot deactivate the last active super administrator account."
              : "Cannot deactivate the last active administrator account.",
          ],
        },
      };
    }
  }

  try {
    // 6. Update status
    await db
      .update(users)
      .set({
        isActive,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 7. Audit log
    await logUpdateAction(
      session,
      "users",
      userId,
      { isActive: existingUser.isActive },
      { isActive },
      { throwOnFail: true }
    );

    logger.info("[users] User status changed", {
      userId,
      isActive,
      actorId: session.userId,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true };
  } catch (err) {
    logger.error("[users] Failed to toggle user status", {
      error: String(err),
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
