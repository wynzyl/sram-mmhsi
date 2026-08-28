/**
 * In-memory sliding window rate limiter with per-account throttling.
 * Intended for use in root proxy (see `proxy.ts`) or login Server Action hardening.
 * Per SRAMS Engineering spec §6 (Rate Limiting) and §9 (Login Procedure).
 *
 * SECURITY ENHANCEMENTS (D-1):
 * - Per-account (username) rate limiting alongside IP-based
 * - Exponential backoff on repeated failures
 * - Never uses shared "unknown" bucket
 *
 * NOTE: This is an in-memory store suitable for single-process deployments
 * (per the spec: modular monolith, single server deployment).
 * For multi-instance deployments, see rateLimit.store.ts for Redis implementation.
 */

type RateLimitEntry = {
  count: number;
  firstAttempt: number;
  consecutiveFailures?: number;  // Track consecutive failures for exponential backoff
};

// Separate stores for different rate limit contexts
const loginAttemptsByIP = new Map<string, RateLimitEntry>();
const loginAttemptsByUsername = new Map<string, RateLimitEntry>();
const adminActionAttempts = new Map<string, RateLimitEntry>();
const reportExportAttempts = new Map<string, RateLimitEntry>();
const emailSendAttempts = new Map<string, RateLimitEntry>();
const documentRequestAttempts = new Map<string, RateLimitEntry>();

// ─── Login Rate Limit Configuration ──────────────────────────────────────────
const LOGIN_BASE_WINDOW_MS = 15 * 60 * 1000;  // 15-minute base window
const LOGIN_MAX_ATTEMPTS_IP = 10;              // max 10 attempts per IP per window
const LOGIN_MAX_ATTEMPTS_USERNAME = 5;         // max 5 attempts per username per window (stricter)

// Exponential backoff: after N consecutive failures, lockout = base * 2^(failures-threshold)
const EXPONENTIAL_BACKOFF_THRESHOLD = 3;       // Start exponential backoff after 3 failures
const MAX_LOCKOUT_MULTIPLIER = 8;              // Cap at 8x the base window (2 hours)

// Admin action rate limits (for user creation, etc.)
const ADMIN_ACTION_WINDOW_MS = 60 * 1000; // 1-minute window
const ADMIN_ACTION_MAX_ATTEMPTS = 10;      // max 10 actions per minute per user

// Report export rate limits (PDF/XLSX generation is resource-intensive)
const REPORT_EXPORT_WINDOW_MS = 60 * 1000; // 1-minute window
const REPORT_EXPORT_MAX_ATTEMPTS = 10;     // max 10 exports per minute per user

// Email sending rate limits (allows batch sending for end-of-month billing)
const EMAIL_SEND_WINDOW_MS = 60 * 1000;    // 1-minute window
const EMAIL_SEND_MAX_ATTEMPTS = 50;         // max 50 emails per minute per user (batch support)

// Document request rate limits
const DOC_REQUEST_WINDOW_MS = 60 * 1000;   // 1-minute window
const DOC_REQUEST_MAX_ATTEMPTS = 10;        // max 10 requests per minute per user

// ─── Helper: Calculate lockout window with exponential backoff ───────────────

function calculateLockoutWindow(consecutiveFailures: number): number {
  if (consecutiveFailures < EXPONENTIAL_BACKOFF_THRESHOLD) {
    return LOGIN_BASE_WINDOW_MS;
  }

  // Exponential backoff: 2^(failures - threshold)
  const exponent = Math.min(
    consecutiveFailures - EXPONENTIAL_BACKOFF_THRESHOLD,
    Math.log2(MAX_LOCKOUT_MULTIPLIER)  // Cap at max multiplier
  );
  const multiplier = Math.pow(2, exponent);

  return Math.min(LOGIN_BASE_WINDOW_MS * multiplier, LOGIN_BASE_WINDOW_MS * MAX_LOCKOUT_MULTIPLIER);
}

// ─── IP-based Rate Limiting ──────────────────────────────────────────────────

/**
 * Check if an IP has exceeded the login rate limit.
 * Returns true if the request should be BLOCKED.
 *
 * SECURITY: Call this with a properly extracted IP from extractClientIP().
 * Never pass "unknown" or null - use extractClientIPForRateLimit() instead.
 */
export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttemptsByIP.get(ip);

  if (!entry) {
    // First attempt from this IP
    loginAttemptsByIP.set(ip, { count: 1, firstAttempt: now, consecutiveFailures: 0 });
    return false;
  }

  const windowMs = calculateLockoutWindow(entry.consecutiveFailures ?? 0);

  if (now - entry.firstAttempt > windowMs) {
    // Window expired — reset (but keep consecutive failures for exponential backoff)
    loginAttemptsByIP.set(ip, {
      count: 1,
      firstAttempt: now,
      consecutiveFailures: entry.consecutiveFailures,
    });
    return false;
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS_IP) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Record a failed login attempt for exponential backoff.
 */
export function recordLoginFailure(ip: string): void {
  const entry = loginAttemptsByIP.get(ip);
  if (entry) {
    entry.consecutiveFailures = (entry.consecutiveFailures ?? 0) + 1;
  }
}

/**
 * Reset the rate limit for an IP after a successful login.
 * Also resets consecutive failures counter.
 */
export function resetLoginRateLimit(ip: string): void {
  loginAttemptsByIP.delete(ip);
}

/**
 * Get the remaining lockout time in seconds for an IP.
 */
export function getRateLimitResetSeconds(ip: string): number {
  const entry = loginAttemptsByIP.get(ip);
  if (!entry) return 0;

  const windowMs = calculateLockoutWindow(entry.consecutiveFailures ?? 0);
  const elapsed = Date.now() - entry.firstAttempt;
  return Math.max(0, Math.ceil((windowMs - elapsed) / 1000));
}

// ─── Username-based Rate Limiting (per-account throttling) ───────────────────

/**
 * Check if a username has exceeded the login rate limit.
 * This provides per-account protection against targeted attacks.
 *
 * Returns true if the request should be BLOCKED.
 */
export function isUsernameRateLimited(username: string): boolean {
  const normalizedUsername = username.toLowerCase();
  const now = Date.now();
  const entry = loginAttemptsByUsername.get(normalizedUsername);

  if (!entry) {
    loginAttemptsByUsername.set(normalizedUsername, {
      count: 1,
      firstAttempt: now,
      consecutiveFailures: 0,
    });
    return false;
  }

  const windowMs = calculateLockoutWindow(entry.consecutiveFailures ?? 0);

  if (now - entry.firstAttempt > windowMs) {
    loginAttemptsByUsername.set(normalizedUsername, {
      count: 1,
      firstAttempt: now,
      consecutiveFailures: entry.consecutiveFailures,
    });
    return false;
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS_USERNAME) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Record a failed login attempt for a username (exponential backoff).
 */
export function recordUsernameFailure(username: string): void {
  const normalizedUsername = username.toLowerCase();
  const entry = loginAttemptsByUsername.get(normalizedUsername);
  if (entry) {
    entry.consecutiveFailures = (entry.consecutiveFailures ?? 0) + 1;
  }
}

/**
 * Reset the rate limit for a username after a successful login.
 */
export function resetUsernameRateLimit(username: string): void {
  loginAttemptsByUsername.delete(username.toLowerCase());
}

/**
 * Get the remaining lockout time in seconds for a username.
 */
export function getUsernameRateLimitResetSeconds(username: string): number {
  const entry = loginAttemptsByUsername.get(username.toLowerCase());
  if (!entry) return 0;

  const windowMs = calculateLockoutWindow(entry.consecutiveFailures ?? 0);
  const elapsed = Date.now() - entry.firstAttempt;
  return Math.max(0, Math.ceil((windowMs - elapsed) / 1000));
}

// ─── Combined Rate Limit Check ───────────────────────────────────────────────

/**
 * Check both IP and username rate limits.
 * Returns an object indicating which limits are hit.
 *
 * Usage in login action:
 * ```
 * const limits = checkLoginRateLimits(ip, username);
 * if (limits.blocked) {
 *   return { message: limits.message };
 * }
 * ```
 */
export function checkLoginRateLimits(
  ip: string,
  username: string
): { blocked: boolean; byIP: boolean; byUsername: boolean; message: string } {
  const byIP = isLoginRateLimited(ip);
  const byUsername = isUsernameRateLimited(username);

  if (byIP || byUsername) {
    const ipResetSeconds = getRateLimitResetSeconds(ip);
    const usernameResetSeconds = getUsernameRateLimitResetSeconds(username);
    const maxResetSeconds = Math.max(ipResetSeconds, usernameResetSeconds);
    const resetMinutes = Math.ceil(maxResetSeconds / 60);

    return {
      blocked: true,
      byIP,
      byUsername,
      message: `Too many login attempts. Please try again in ${resetMinutes} minute${resetMinutes !== 1 ? "s" : ""}.`,
    };
  }

  return { blocked: false, byIP: false, byUsername: false, message: "" };
}

/**
 * Record a login failure for both IP and username.
 */
export function recordLoginFailures(ip: string, username: string): void {
  recordLoginFailure(ip);
  recordUsernameFailure(username);
}

/**
 * Reset rate limits for both IP and username after successful login.
 */
export function resetLoginRateLimits(ip: string, username: string): void {
  resetLoginRateLimit(ip);
  resetUsernameRateLimit(username);
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

// ─── Report Export Rate Limiting ────────────────────────────────────────────────

/**
 * Check if a user has exceeded the report export rate limit.
 * PDF/XLSX generation is resource-intensive, so we limit exports per user.
 * Returns true if the request should be BLOCKED.
 *
 * @param userId - The user ID requesting the export
 */
export function isReportExportRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = reportExportAttempts.get(userId);

  if (!entry || now - entry.firstAttempt > REPORT_EXPORT_WINDOW_MS) {
    // New window — reset
    reportExportAttempts.set(userId, { count: 1, firstAttempt: now });
    return false;
  }

  if (entry.count >= REPORT_EXPORT_MAX_ATTEMPTS) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Get the remaining lockout time in seconds for report export.
 */
export function getReportExportResetSeconds(userId: string): number {
  const entry = reportExportAttempts.get(userId);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstAttempt;
  return Math.max(0, Math.ceil((REPORT_EXPORT_WINDOW_MS - elapsed) / 1000));
}

// ─── Email Send Rate Limiting ─────────────────────────────────────────────────

/**
 * Check if a user has exceeded the email send rate limit.
 * Allows batch sending (50 emails/minute) for end-of-month billing operations.
 * Returns true if the request should be BLOCKED.
 *
 * @param userId - The user ID sending the email
 */
export function isEmailSendRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = emailSendAttempts.get(userId);

  if (!entry || now - entry.firstAttempt > EMAIL_SEND_WINDOW_MS) {
    // New window — reset
    emailSendAttempts.set(userId, { count: 1, firstAttempt: now });
    return false;
  }

  if (entry.count >= EMAIL_SEND_MAX_ATTEMPTS) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Get the remaining lockout time in seconds for email sending.
 */
export function getEmailSendResetSeconds(userId: string): number {
  const entry = emailSendAttempts.get(userId);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstAttempt;
  return Math.max(0, Math.ceil((EMAIL_SEND_WINDOW_MS - elapsed) / 1000));
}

/**
 * Get the remaining email send capacity in the current window.
 * Returns the number of emails that can still be sent before hitting the limit.
 *
 * @param userId - The user ID to check
 * @returns Number of remaining sends available (0 to EMAIL_SEND_MAX_ATTEMPTS)
 */
export function getEmailSendRemainingCapacity(userId: string): number {
  const now = Date.now();
  const entry = emailSendAttempts.get(userId);

  if (!entry || now - entry.firstAttempt > EMAIL_SEND_WINDOW_MS) {
    // New window or no entry - full capacity
    return EMAIL_SEND_MAX_ATTEMPTS;
  }

  return Math.max(0, EMAIL_SEND_MAX_ATTEMPTS - entry.count);
}

/**
 * Check if a batch of emails can be sent without exceeding the rate limit.
 * Unlike isEmailSendRateLimited, this checks if the ENTIRE batch can fit.
 *
 * @param userId - The user ID sending the emails
 * @param batchSize - Number of emails in the batch
 * @returns Object with blocked status and capacity info
 */
export function checkEmailBatchCapacity(
  userId: string,
  batchSize: number
): { blocked: boolean; remainingCapacity: number; resetSeconds: number } {
  const remainingCapacity = getEmailSendRemainingCapacity(userId);
  const resetSeconds = getEmailSendResetSeconds(userId);

  if (batchSize > remainingCapacity) {
    return {
      blocked: true,
      remainingCapacity,
      resetSeconds,
    };
  }

  return {
    blocked: false,
    remainingCapacity,
    resetSeconds,
  };
}

/**
 * Reserve email send capacity for a batch operation.
 * Call this before sending to prevent other operations from consuming capacity.
 *
 * @param userId - The user ID sending the emails
 * @param count - Number of emails to reserve
 */
export function reserveEmailSendCapacity(userId: string, count: number): void {
  const now = Date.now();
  const entry = emailSendAttempts.get(userId);

  if (!entry || now - entry.firstAttempt > EMAIL_SEND_WINDOW_MS) {
    // New window - start fresh with reserved count
    emailSendAttempts.set(userId, { count, firstAttempt: now });
  } else {
    // Add to existing count
    entry.count += count;
  }
}

// ─── Document Request Rate Limiting ───────────────────────────────────────────

/**
 * Check if a user has exceeded the document request rate limit.
 * Allows batch processing (10 requests/minute) for administrative workflows.
 * Returns true if the request should be BLOCKED.
 *
 * @param userId - The user ID creating the document request
 */
export function isDocumentRequestRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = documentRequestAttempts.get(userId);

  if (!entry || now - entry.firstAttempt > DOC_REQUEST_WINDOW_MS) {
    // New window — reset
    documentRequestAttempts.set(userId, { count: 1, firstAttempt: now });
    return false;
  }

  if (entry.count >= DOC_REQUEST_MAX_ATTEMPTS) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Get the remaining lockout time in seconds for document requests.
 */
export function getDocumentRequestResetSeconds(userId: string): number {
  const entry = documentRequestAttempts.get(userId);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstAttempt;
  return Math.max(0, Math.ceil((DOC_REQUEST_WINDOW_MS - elapsed) / 1000));
}
