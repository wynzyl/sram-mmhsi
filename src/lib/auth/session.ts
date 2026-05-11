import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import type { Role } from "@/lib/constants/roles";
import {
  SESSION_COOKIE_NAME,
  encryptSessionJwt,
  decryptSessionJwt,
  type SessionPayload,
} from "@/lib/auth/session-token";

// ─── Types ────────────────────────────────────────────────────────────────────

export type { SessionPayload };

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
  meta: { ipAddress?: string; userAgent?: string } = {}
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
  const jwt = await encryptSession({ sessionId, userId, role, expiresAt });

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
    redirect("/login");
    throw new Error("Redirecting...");
  }
  return session;
}
