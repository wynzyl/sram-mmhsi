"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq, and, ilike, isNull, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  ToggleUserStatusSchema,
} from "@/lib/validators/user";
import type {
  CreateUserFormState,
  UpdateUserFormState,
  ResetPasswordFormState,
  ToggleUserStatusFormState,
} from "@/lib/validators/user";
import { logger } from "@/lib/observability/logger";
import bcrypt from "bcryptjs";

// ─── Audit Helper ─────────────────────────────────────────────────────────────

async function audit(
  actorId: string,
  actorRole: string,
  action: string,
  targetEntity: string,
  targetId: string,
  previousState?: object,
  newState?: object
) {
  try {
    await db.insert(auditLogs).values({
      actor: actorId,
      actorRole,
      action,
      targetEntity,
      targetId,
      previousState: previousState ? JSON.stringify(previousState) : undefined,
      newState: newState ? JSON.stringify(newState) : undefined,
      correlationId: crypto.randomUUID(),
    });
  } catch (err) {
    logger.error("[audit] Failed to write", { error: String(err) });
  }
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

  // 2. Validate
  const parsed = CreateUserSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
    forcePasswordChange: formData.get("forcePasswordChange") === "true",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as CreateUserFormState["errors"],
    };
  }

  const { password, ...userData } = parsed.data;

  // 3. Duplicate detection
  const existingEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(ilike(users.email, userData.email), isNull(users.deletedAt))
    )
    .limit(1);

  if (existingEmail.length > 0) {
    return {
      errors: {
        email: ["This email is already in use."],
      },
    };
  }

  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(ilike(users.username, userData.username), isNull(users.deletedAt))
    )
    .limit(1);

  if (existingUsername.length > 0) {
    return {
      errors: {
        username: ["This username is already in use."],
      },
    };
  }

  try {
    // 4. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

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
    await audit(
      session.userId,
      session.role,
      "user_created",
      "users",
      newUser.id,
      undefined,
      { email: userData.email, username: userData.username, role: userData.role }
    );

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
  const parsed = UpdateUserSchema.safeParse({
    userId: formData.get("userId"),
    email: formData.get("email"),
    username: formData.get("username"),
    role: formData.get("role"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as UpdateUserFormState["errors"],
    };
  }

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

  // 6. Prevent deactivation of last active admin
  if (updateData.isActive === false && existingUser.role === "admin") {
    const activeAdminCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isActive, true),
          isNull(users.deletedAt)
        )
      );

    if ((activeAdminCount[0]?.count ?? 0) <= 1) {
      return {
        errors: {
          isActive: [
            "Cannot deactivate the last active administrator account.",
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
    await audit(
      session.userId,
      session.role,
      "user_updated",
      "users",
      userId,
      {
        email: existingUser.email,
        username: existingUser.username,
        role: existingUser.role,
        isActive: existingUser.isActive,
      },
      updateData
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
  const parsed = ResetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
    forcePasswordChange: formData.get("forcePasswordChange") === "true",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as ResetPasswordFormState["errors"],
    };
  }

  const { userId, newPassword, forcePasswordChange } = parsed.data;

  // 3. Check user exists
  const [existingUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!existingUser) {
    return { message: "User not found." };
  }

  try {
    // 4. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

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
    await audit(
      session.userId,
      session.role,
      "password_reset",
      "users",
      userId,
      undefined,
      { forcePasswordChange }
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
  const parsed = ToggleUserStatusSchema.safeParse({
    userId: formData.get("userId"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as ToggleUserStatusFormState["errors"],
    };
  }

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

  // 4. Prevent self-deactivation
  if (isActive === false && userId === session.userId) {
    return {
      errors: {
        _form: ["You cannot deactivate your own account."],
      },
    };
  }

  // 5. Prevent deactivation of last active admin
  if (isActive === false && existingUser.role === "admin") {
    const activeAdminCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isActive, true),
          isNull(users.deletedAt)
        )
      );

    if ((activeAdminCount[0]?.count ?? 0) <= 1) {
      return {
        errors: {
          _form: ["Cannot deactivate the last active administrator account."],
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
    await audit(
      session.userId,
      session.role,
      "user_status_changed",
      "users",
      userId,
      { isActive: existingUser.isActive },
      { isActive }
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
