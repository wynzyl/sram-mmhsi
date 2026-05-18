/**
 * In-memory sliding window rate limiter.
 * Intended for use in root proxy (see `proxy.ts`) or login Server Action hardening.
 * Per SRAMS Engineering spec §6 (Rate Limiting) and §9 (Login Procedure).
 *
 * NOTE: This is an in-memory store suitable for single-process deployments
 * (per the spec: modular monolith, single server deployment).
 * For multi-instance deployments, replace with a Redis-backed store.
 */

type RateLimitEntry = {
  count: number;
  firstAttempt: number;
};

// Separate stores for different rate limit contexts
const loginAttempts = new Map<string, RateLimitEntry>();
const adminActionAttempts = new Map<string, RateLimitEntry>();

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15-minute window
const LOGIN_MAX_ATTEMPTS = 10;            // max 10 attempts per window

// Admin action rate limits (for user creation, etc.)
const ADMIN_ACTION_WINDOW_MS = 60 * 1000; // 1-minute window
const ADMIN_ACTION_MAX_ATTEMPTS = 10;      // max 10 actions per minute per user

/**
 * Check if an IP has exceeded the login rate limit.
 * Returns true if the request should be BLOCKED.
 */
export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    // New window — reset
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return false;
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Reset the rate limit for an IP after a successful login.
 */
export function resetLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Get the remaining lockout time in seconds for an IP.
 */
export function getRateLimitResetSeconds(ip: string): number {
  const entry = loginAttempts.get(ip);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstAttempt;
  return Math.max(0, Math.ceil((LOGIN_WINDOW_MS - elapsed) / 1000));
}

// ─── Admin Action Rate Limiting ────────────────────────────────────────────────

/**
 * Check if a user has exceeded the admin action rate limit.
 * Used to prevent abuse of sensitive operations like user creation.
 * Returns true if the request should be BLOCKED.
 *
 * @param userId - The user ID performing the action
 */
export function isAdminActionRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = adminActionAttempts.get(userId);

  if (!entry || now - entry.firstAttempt > ADMIN_ACTION_WINDOW_MS) {
    // New window — reset
    adminActionAttempts.set(userId, { count: 1, firstAttempt: now });
    return false;
  }

  if (entry.count >= ADMIN_ACTION_MAX_ATTEMPTS) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Get the remaining lockout time in seconds for an admin action.
 */
export function getAdminActionResetSeconds(userId: string): number {
  const entry = adminActionAttempts.get(userId);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstAttempt;
  return Math.max(0, Math.ceil((ADMIN_ACTION_WINDOW_MS - elapsed) / 1000));
}
