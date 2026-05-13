"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { LoginSchema, type LoginFormState } from "./auth.schema";
import { createSession, deleteSession } from "@/lib/auth/session";
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

  await createSession(user.id, normalizedRole);

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
