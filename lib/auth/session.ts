import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import type { Role } from "@/lib/constants/roles";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionPayload = {
  sessionId: string;
  userId: string;
  role: Role;
  expiresAt: Date;
};

export type SessionUser = {
  id: string;
  role: Role;
  email: string;
  username: string;
  forcePasswordChange: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COOKIE_NAME = "srams_session";
// 10-hour session per Engineering spec §9 (8-12 hr idle business session)
const SESSION_DURATION_MS = 10 * 60 * 60 * 1000;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("[SRAMS] AUTH_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

// ─── JWT encrypt / decrypt ────────────────────────────────────────────────────

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    sessionId: payload.sessionId,
    userId: payload.userId,
    role: payload.role,
    expiresAt: payload.expiresAt.toISOString(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .sign(getSecretKey());
}

export async function decryptSession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return {
      sessionId: payload.sessionId as string,
      userId: payload.userId as string,
      role: payload.role as Role,
      expiresAt: new Date(payload.expiresAt as string),
    };
  } catch {
    return null;
  }
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
  cookieStore.set(COOKIE_NAME, jwt, {
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
  const token = cookieStore.get(COOKIE_NAME)?.value;
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
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return;

  const payload = await decryptSession(token);
  if (!payload) return;

  const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const newJwt = await encryptSession({ ...payload, expiresAt: newExpiresAt });

  await db
    .update(sessions)
    .set({ token: newJwt, expiresAt: newExpiresAt })
    .where(eq(sessions.id, payload.sessionId));

  cookieStore.set(COOKIE_NAME, newJwt, {
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
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const payload = await decryptSession(token);
    if (payload?.sessionId) {
      await db.delete(sessions).where(eq(sessions.id, payload.sessionId));
    }
  }

  cookieStore.delete(COOKIE_NAME);
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
