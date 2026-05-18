"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import {
  LoginSchema,
  ChangePasswordSchema,
  type LoginFormState,
  type ChangePasswordFormState,
} from "./auth.schema";
import {
  createSession,
  deleteSession,
  getCurrentSession,
} from "@/lib/auth/session";
import { logAudit } from "@/lib/utils/audit-logger";
import { logger } from "@/lib/observability/logger";
import type { Role } from "@/lib/constants/roles";
import { normalizeRole } from "@/lib/constants/roles";
import {
  isLoginRateLimited,
  resetLoginRateLimit,
  getRateLimitResetSeconds,
} from "@/lib/security/rateLimit";

// ─── Role → Landing Page Map ──────────────────────────────────────────────────

const ROLE_LANDING: Record<Role, string> = {
  super_admin: "/admin/dashboard",
  admin: "/admin/dashboard",
  registrar: "/staff/dashboard",
  finance_officer: "/staff/finance",
  cashier: "/staff/payments",
  teacher: "/staff/grades",
  student: "/portal/dashboard",
  parent_guardian: "/portal/dashboard",
};

// ─── Login Action ─────────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  // 0. Get client IP for rate limiting
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

  // 0.1 Check rate limit before processing
  if (isLoginRateLimited(clientIp)) {
    const resetSeconds = getRateLimitResetSeconds(clientIp);
    const resetMinutes = Math.ceil(resetSeconds / 60);
    logger.warn("[auth] Rate limit exceeded", { ip: clientIp });
    return {
      message: `Too many login attempts. Please try again in ${resetMinutes} minute${resetMinutes !== 1 ? "s" : ""}.`,
    };
  }

  // 1. Validate inputs with Zod
  const parsed = LoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { username, password } = parsed.data;

  // 2. Look up user by username OR email (constant-time pattern)
  let user;
  try {
    user = await db.query.users.findFirst({
      where: or(eq(users.username, username), eq(users.email, username)),
      columns: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        role: true,
        isActive: true,
        forcePasswordChange: true,
      },
    });
  } catch (error) {
    logger.error("[auth] Database query failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      message: "Database error. Please ensure migrations are applied (npm run db:migrate) and the database is running.",
    };
  }

  // 3. Compare password — always run compare to prevent timing attacks
  const dummyHash =
    "$2b$10$dummyhashfortimingneutralityXXXXXXXXXXXXXXXX";
  const isValid = await compare(password, user?.passwordHash ?? dummyHash);

  if (!user || !isValid || !user.isActive) {
    logger.warn("[auth] Failed login attempt", { username });
    await logAudit({
      actor: user?.id ?? null,
      actorRole: "system",
      action: "auth:login_failed",
      targetEntity: "users",
      targetId: "unknown",
      context: `username=${username}`,
    });
    // Generic message — do not leak whether user exists
    return { message: "Invalid credentials. Please try again." };
  }

  // 4. Create server-side session
  const normalizedRole = normalizeRole(user.role);
  if (!normalizedRole) {
    logger.error("[auth] User has unsupported role", { userId: user.id, role: user.role });
    await logAudit({
      actor: user.id,
      actorRole: "system",
      action: "auth:login_failed",
      targetEntity: "users",
      targetId: user.id,
      context: `unsupported_role=${user.role}`,
    });
    return { message: "Your account role is not supported. Please contact system support." };
  }

  await createSession(user.id, normalizedRole, {
    forcePasswordChange: user.forcePasswordChange,
  });

  // 5. Audit: successful login
  logger.info("[auth] User logged in", { userId: user.id, role: user.role });
  await logAudit({
    actor: user.id,
    actorRole: user.role,
    action: "auth:login_success",
    targetEntity: "users",
    targetId: user.id,
  });

  // 5.1 Reset rate limit on successful login
  resetLoginRateLimit(clientIp);

  // 6. Redirect to role landing page
  // redirect() throws internally — must be called outside try/catch
  const landing = ROLE_LANDING[normalizedRole] ?? "/login";
  redirect(landing);
}

// ─── Logout Action ────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await deleteSession();
  logger.info("[auth] User logged out");
  redirect("/login");
}

// ─── Change Password Action ──────────────────────────────────────────────────

export async function changePasswordAction(
  _prevState: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  // 1. Require authenticated session
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  // 2. Validate inputs with Zod
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { currentPassword, newPassword } = parsed.data;

  // 3. Look up user and verify current password
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      id: true,
      passwordHash: true,
      role: true,
    },
  });

  if (!user) {
    return { message: "User not found. Please log in again." };
  }

  const isCurrentValid = await compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    return {
      errors: {
        currentPassword: ["Current password is incorrect."],
      },
    };
  }

  try {
    // 4. Hash new password and update user
    const newPasswordHash = await hash(newPassword, 10);

    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        forcePasswordChange: false, // Clear the flag
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(eq(users.id, session.userId));

    // 5. Audit log
    logger.info("[auth] User changed password", { userId: session.userId });
    await logAudit({
      actor: session.userId,
      actorRole: user.role,
      action: "auth:password_changed",
      targetEntity: "users",
      targetId: session.userId,
    });

    // 6. Delete current session and redirect to login
    // User must log in again with new password
    await deleteSession();

  } catch (error) {
    logger.error("[auth] Failed to change password", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { message: "An error occurred. Please try again." };
  }

  // redirect() throws internally — must be called outside try/catch
  redirect("/login?passwordChanged=true");
}
