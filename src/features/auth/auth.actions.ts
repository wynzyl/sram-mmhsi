"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { compare, hash, hashSync, getRounds } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

// SECURITY (A-6): bcrypt cost factor
// Cost 12 provides ~4x more resistance than cost 10 against offline attacks
const BCRYPT_COST = 12;

// SECURITY (D-2): Dummy hash for timing-neutral login.
// MUST use the same cost factor as real password hashes so that bcrypt.compare()
// consumes identical CPU time for a non-existent user as for a real one. A hard-coded
// lower-cost hash (e.g. $2b$10$...) leaks user existence via a measurable timing oracle.
// Computed once at module load so it can never drift from BCRYPT_COST.
const DUMMY_PASSWORD_HASH = hashSync("timing-neutral-dummy-password", BCRYPT_COST);
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
import { normalizeRole, ROLE_LANDING } from "@/lib/constants/roles";
import {
  checkLoginRateLimits,
  recordLoginFailures,
  resetLoginRateLimits,
} from "@/lib/security/rateLimit";
import { extractClientIPForRateLimit, UNVERIFIED_IP_BUCKET } from "@/lib/security/ipExtraction";

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
  // SECURITY (D-3): Fails closed to a shared bucket when the IP is undeterminable.
  const headersList = await headers();
  const clientIp = extractClientIPForRateLimit(headersList);
  if (clientIp === UNVERIFIED_IP_BUCKET) {
    // Indicates a likely proxy misconfiguration (no X-Forwarded-For). Logins still work
    // (per-username throttling applies) but IP throttling is degraded to a shared bucket.
    logger.warn("[auth] Client IP undeterminable — IP rate limiting degraded to shared bucket", {
      hint: "Ensure the reverse proxy sets X-Forwarded-For and TRUSTED_PROXY_COUNT is correct.",
    });
  }

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

  // 3. Compare password — always run compare to prevent timing attacks.
  // Uses a cost-matched dummy hash (DUMMY_PASSWORD_HASH) so timing does not reveal
  // whether the account exists.
  const isValid = await compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

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

  try {
    await createSession(user.id, normalizedRole, {
      forcePasswordChange: user.forcePasswordChange,
    });
  } catch (error) {
    logger.error("[auth] Failed to create session", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { message: "Login failed. Please try again." };
  }

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
  // to ensure the Set-Cookie header is properly included in the 303 response.
  // Users flagged for a forced password change go straight to /change-password —
  // redirecting to the landing page and letting the proxy gate bounce them there
  // leaves the address bar showing the landing URL while the change-password
  // form renders (proxy redirects of RSC navigations don't always sync the URL).
  const landing = user.forcePasswordChange
    ? "/change-password"
    : (ROLE_LANDING[normalizedRole] ?? "/login");
  redirect(landing);
}

// ─── Logout Action ────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await deleteSession();
  logger.info("[auth] User logged out");
  redirect("/");
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

  // 3. Look up user and verify current password (with error handling)
  let user;
  try {
    user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        passwordHash: true,
        role: true,
      },
    });
  } catch (error) {
    logger.error("[auth] Failed to look up user for password change", {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { message: "Database error. Please try again." };
  }

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

  // 4. Hash new password and update DB
  try {
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
  } catch (error) {
    logger.error("[auth] Failed to update password in database", {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { message: "Failed to update password. Please try again." };
  }

  // 5. Password updated successfully - log and cleanup
  logger.info("[auth] User changed password", { userId: session.userId });

  // Fire-and-forget audit log (don't block redirect)
  void logAudit({
    actor: session.userId,
    actorRole: user.role,
    action: "auth:password_changed",
    targetEntity: "users",
    targetId: session.userId,
  });

  // 6. Delete session (best-effort - don't fail if this errors)
  // Password was changed successfully, session deletion is cleanup only
  try {
    await deleteSession();
  } catch (error) {
    logger.warn("[auth] Failed to delete session after password change", {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue anyway - password was changed successfully
  }

  // 7. Always redirect to login after successful password change
  // redirect() throws internally — must be called outside try/catch
  redirect("/login?passwordChanged=true");
}
