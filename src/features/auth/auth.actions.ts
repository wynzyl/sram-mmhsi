"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { compare, hash, getRounds } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

// SECURITY (A-6): bcrypt cost factor
// Cost 12 provides ~4x more resistance than cost 10 against offline attacks
const BCRYPT_COST = 12;
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
import { parseFormData } from "@/lib/utils/form-validation";
import { logger } from "@/lib/observability/logger";
import type { Role } from "@/lib/constants/roles";
import { normalizeRole } from "@/lib/constants/roles";
import {
  checkLoginRateLimits,
  recordLoginFailures,
  resetLoginRateLimits,
} from "@/lib/security/rateLimit";
import { extractClientIPForRateLimit } from "@/lib/security/ipExtraction";

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
  // 0. Validate inputs first (needed for username-based rate limiting)
  const result = parseFormData(LoginSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { username, password } = result.data;

  // 0.1 Get client IP securely for rate limiting
  // SECURITY (D-1): Use proper IP extraction that handles spoofed X-Forwarded-For
  const headersList = await headers();
  const clientIp = extractClientIPForRateLimit(headersList, username);

  // 0.2 Check both IP and username rate limits
  // SECURITY (D-1): Per-account throttling prevents targeted attacks
  const rateLimitCheck = checkLoginRateLimits(clientIp, username);
  if (rateLimitCheck.blocked) {
    logger.warn("[auth] Rate limit exceeded", {
      ip: clientIp,
      username,
      byIP: rateLimitCheck.byIP,
      byUsername: rateLimitCheck.byUsername,
    });
    return { message: rateLimitCheck.message };
  }

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
    // SECURITY (D-1): Record failure for exponential backoff
    recordLoginFailures(clientIp, username);

    logger.warn("[auth] Failed login attempt", { username, ip: clientIp });
    await logAudit({
      actor: user?.id ?? null,
      actorRole: "system",
      action: "auth:login_failed",
      targetEntity: "users",
      targetId: "unknown",
      context: `username=${username}, ip=${clientIp}`,
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

  // 4.1 SECURITY (A-6): Transparent re-hash if password uses weaker cost factor
  // This upgrades existing passwords to the current BCRYPT_COST on successful login
  const currentCost = getRounds(user.passwordHash);
  if (currentCost < BCRYPT_COST) {
    // Fire-and-forget: upgrade hash in background without blocking login
    void (async () => {
      try {
        const upgradedHash = await hash(password, BCRYPT_COST);
        await db.update(users)
          .set({ passwordHash: upgradedHash, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        logger.info("[auth] Password hash upgraded", {
          userId: user.id,
          oldCost: currentCost,
          newCost: BCRYPT_COST,
        });
      } catch (err) {
        // Non-critical: log and continue (user is already logged in)
        logger.warn("[auth] Failed to upgrade password hash", {
          userId: user.id,
          error: String(err),
        });
      }
    })();
  }

  // 5. Reset rate limits on successful login (sync operation)
  // SECURITY (D-1): Reset both IP and username rate limits
  resetLoginRateLimits(clientIp, username);

  // 5.1 Log success (non-blocking - don't await before redirect)
  logger.info("[auth] User logged in", { userId: user.id, role: user.role });

  // Fire-and-forget audit log - redirect must happen immediately after session creation
  // to ensure Set-Cookie header is included in the response
  void logAudit({
    actor: user.id,
    actorRole: user.role,
    action: "auth:login_success",
    targetEntity: "users",
    targetId: user.id,
  });

  // 6. CRITICAL: redirect() must be called immediately after createSession()
  // to ensure the Set-Cookie header is properly included in the 303 response
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
  const result = parseFormData(ChangePasswordSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { currentPassword, newPassword } = result.data;

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
    // SECURITY (A-6): Use current bcrypt cost factor
    const newPasswordHash = await hash(newPassword, BCRYPT_COST);

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
