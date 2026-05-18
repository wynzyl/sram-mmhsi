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
