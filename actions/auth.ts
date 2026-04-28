"use server";

import { redirect } from "next/navigation";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { LoginSchema, type LoginFormState } from "@/lib/validators/auth";
import { createSession, deleteSession } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import type { Role } from "@/lib/constants/roles";
import { STAFF_ROLES } from "@/lib/constants/roles";

// ─── Role → Landing Page Map ──────────────────────────────────────────────────

const ROLE_LANDING: Record<Role, string> = {
  admin: "/admin/dashboard",
  registrar: "/staff/students",
  finance_officer: "/staff/finance",
  cashier: "/staff/payments",
  teacher: "/staff/grades",
  student: "/portal/dashboard",
  parent_guardian: "/portal/dashboard",
};

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function writeAuditLog(
  action: string,
  targetId: string | null,
  actorId: string | null,
  actorRole: string | null,
  context?: string
) {
  try {
    await db.insert(auditLogs).values({
      actor: actorId ?? undefined,
      actorRole: actorRole ?? undefined,
      action,
      targetEntity: "users",
      targetId: targetId ?? undefined,
      context: context ?? undefined,
      correlationId: crypto.randomUUID(),
    });
  } catch (err) {
    logger.error("[audit] Failed to write audit log", { action, error: String(err) });
  }
}

// ─── Login Action ─────────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
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
  const user = await db.query.users.findFirst({
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

  // 3. Compare password — always run compare to prevent timing attacks
  const dummyHash =
    "$2b$10$dummyhashfortimingneutralityXXXXXXXXXXXXXXXX";
  const isValid = await compare(password, user?.passwordHash ?? dummyHash);

  if (!user || !isValid || !user.isActive) {
    logger.warn("[auth] Failed login attempt", { username });
    await writeAuditLog("login_failed", null, null, null, `username=${username}`);
    // Generic message — do not leak whether user exists
    return { message: "Invalid credentials. Please try again." };
  }

  // 4. Create server-side session
  await createSession(user.id, user.role as Role);

  // 5. Audit: successful login
  logger.info("[auth] User logged in", { userId: user.id, role: user.role });
  await writeAuditLog("login_success", user.id, user.id, user.role);

  // 6. Redirect to role landing page
  // redirect() throws internally — must be called outside try/catch
  const landing = ROLE_LANDING[user.role as Role] ?? "/login";
  redirect(landing);
}

// ─── Logout Action ────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await deleteSession();
  logger.info("[auth] User logged out");
  redirect("/login");
}
