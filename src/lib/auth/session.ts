import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import type { Role } from "@/lib/constants/roles";
import { logger } from "@/lib/observability/logger";
import {
  SESSION_COOKIE_NAME,
  INVALID_SESSION_REDIRECT,
  encryptSessionJwt,
  decryptSessionJwt,
  type SessionPayload,
} from "@/lib/auth/session-token";

// ─── Types ────────────────────────────────────────────────────────────────────

export type { SessionPayload };
// Re-exported so layouts/pages can import it alongside requireSession/getCurrentUser.
export { INVALID_SESSION_REDIRECT };

export type SessionUser = {
  id: string;
  role: Role;
  email: string;
  username: string;
  forcePasswordChange: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// 10-hour session per Engineering spec §9 (8-12 hr idle business session)
const SESSION_DURATION_MS = 10 * 60 * 60 * 1000;

/** @deprecated Prefer SESSION_COOKIE_NAME from session-token — kept for call sites importing this name */
export const COOKIE_NAME = SESSION_COOKIE_NAME;

// ─── JWT encrypt / decrypt (Edge-safe implementation in session-token.ts) ───────

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return encryptSessionJwt(payload);
}

export async function decryptSession(
  token: string | undefined
): Promise<SessionPayload | null> {
  return decryptSessionJwt(token);
}

// ─── Create session ───────────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  role: Role,
  meta: { ipAddress?: string; userAgent?: string; forcePasswordChange?: boolean } = {}
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // 1. Persist session record in DB
  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      token: crypto.randomUUID(), // placeholder, overwritten below
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })
    .returning({ id: sessions.id });

  const sessionId = row.id;

  // 2. Build signed JWT containing the session ID
  const jwt = await encryptSession({
    sessionId,
    userId,
    role,
    expiresAt,
    forcePasswordChange: meta.forcePasswordChange ?? false,
  });

  // 3. Update DB row with the actual token (used for server-side revocation)
  await db
    .update(sessions)
    .set({ token: jwt })
    .where(eq(sessions.id, sessionId));

  // 4. Set the cookie (server-side only — httpOnly)
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

// ─── Get current session ──────────────────────────────────────────────────────

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await decryptSession(token);
  if (!payload) return null;

  // Verify token still valid in DB (enables server-side revocation)
  const dbSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, payload.sessionId),
      eq(sessions.token, token),
      gt(sessions.expiresAt, new Date())
    ),
  });

  if (!dbSession) return null;

  // SECURITY (A-2): Validate session binding to User-Agent and IP
  // Wrapped in try-catch to ensure session validation doesn't break auth flow
  try {
    const h = await headers();
    const currentUA = h.get("user-agent") ?? "";
    const currentIP = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // Hard-fail on User-Agent mismatch (strong tampering signal)
    // Note: We only validate if the session has a stored UA (backwards compatible)
    if (dbSession.userAgent && dbSession.userAgent !== currentUA) {
      logger.warn("[session] User-Agent mismatch - possible session hijack", {
        sessionId: dbSession.id,
        storedUA: dbSession.userAgent,
        currentUA,
      });
      // Invalidate the compromised session
      await db.delete(sessions).where(eq(sessions.id, dbSession.id));
      return null;
    }

    // Soft log on IP change (mobile networks/NAT can cause legitimate changes)
    // We don't hard-fail here to avoid false positives
    if (dbSession.ipAddress && dbSession.ipAddress !== currentIP) {
      logger.info("[session] IP address changed during session", {
        sessionId: dbSession.id,
        storedIP: dbSession.ipAddress,
        currentIP,
      });
    }
  } catch (error) {
    // If headers() fails (e.g., during certain edge cases), log and continue
    // Session is still valid based on token verification above
    logger.warn("[session] Failed to validate session binding", {
      sessionId: dbSession.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return payload;
}

// ─── Get current session user ─────────────────────────────────────────────────

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, session.userId), eq(users.isActive, true)),
    columns: {
      id: true,
      role: true,
      email: true,
      username: true,
      forcePasswordChange: true,
    },
  });

  if (!user) return null;
  return user as SessionUser;
}

// ─── Sliding renewal ──────────────────────────────────────────────────────────

export async function renewSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;

  const payload = await decryptSession(token);
  if (!payload) return;

  const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const newJwt = await encryptSession({ ...payload, expiresAt: newExpiresAt });

  await db
    .update(sessions)
    .set({ token: newJwt, expiresAt: newExpiresAt })
    .where(eq(sessions.id, payload.sessionId));

  cookieStore.set(SESSION_COOKIE_NAME, newJwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: newExpiresAt,
    path: "/",
  });
}

// ─── Delete session (logout) ──────────────────────────────────────────────────

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const payload = await decryptSession(token);
    if (payload?.sessionId) {
      await db.delete(sessions).where(eq(sessions.id, payload.sessionId));
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

// ─── Require session (throws redirect-compatible error) ───────────────────────

export async function requireSession(): Promise<SessionPayload> {
  const session = await getCurrentSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    // Use the invalid-session signal so proxy.ts clears the stale cookie instead
    // of redirecting the still-"authenticated" JWT back here (infinite loop).
    redirect(INVALID_SESSION_REDIRECT);
    throw new Error("Redirecting...");
  }
  return session;
}
