import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/constants/roles";

export type SessionPayload = {
  sessionId: string;
  userId: string;
  role: Role;
  expiresAt: Date;
  forcePasswordChange?: boolean;
};

/** HttpOnly cookie name — shared by server session helpers and `proxy.ts`. */
export const SESSION_COOKIE_NAME = "srams_session";

/**
 * Query param the server layer adds when redirecting to /login because a JWT is
 * structurally valid but its DB session (or user) is gone — revoked, expired
 * server-side, the user was deactivated, or the database was reset.
 *
 * `proxy.ts` validates the cookie by JWT signature only (it can't reach the DB on
 * the edge), so it would otherwise keep treating the holder as authenticated and
 * redirect /login → landing page → (server rejects) → /login … forever, which the
 * browser shows as a blank flickering page. When the proxy sees this param it
 * trusts the server's verdict, clears the cookie, and lets /login render.
 */
export const SESSION_INVALID_PARAM = "session_invalid";

/** Redirect target for the server layer when it rejects an otherwise-valid JWT. */
export const INVALID_SESSION_REDIRECT = `/login?${SESSION_INVALID_PARAM}=1`;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("[SRAMS] AUTH_SECRET is not set.");

  const encoded = new TextEncoder().encode(secret);
  const MIN_BYTES = 32;
  if (encoded.length < MIN_BYTES) {
    throw new Error(
      `[SRAMS] AUTH_SECRET must be at least ${MIN_BYTES} bytes long.`
    );
  }

  return encoded;
}

export async function encryptSessionJwt(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    sessionId: payload.sessionId,
    userId: payload.userId,
    role: payload.role,
    expiresAt: payload.expiresAt.toISOString(),
    forcePasswordChange: payload.forcePasswordChange ?? false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .sign(getSecretKey());
}

/** Verify JWT only (`proxy.ts` / optimistic reads). Does not hit the database. */
export async function decryptSessionJwt(
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
      forcePasswordChange: payload.forcePasswordChange as boolean | undefined,
    };
  } catch {
    return null;
  }
}
