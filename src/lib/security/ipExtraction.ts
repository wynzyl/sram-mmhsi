/**
 * Secure Client IP Extraction
 *
 * SECURITY: X-Forwarded-For headers can be spoofed by clients.
 * We trust only the rightmost IP addresses based on known proxy count.
 *
 * Example with TRUSTED_PROXY_COUNT=1:
 *   X-Forwarded-For: "spoofed, client-ip, proxy-ip"
 *                              ↑ we trust this one (ips.length - 1 = 2)
 *
 * For direct connections without proxy, use the connection's remote address.
 */

/**
 * Number of trusted reverse proxies between the client and the application.
 * Set this based on your deployment:
 * - 0: Direct connection (no reverse proxy)
 * - 1: One reverse proxy (e.g., nginx, Vercel, Cloudflare)
 * - 2: Two proxies (e.g., CDN → Load Balancer → App)
 *
 * Default is 1 (single reverse proxy is most common).
 */
const TRUSTED_PROXY_COUNT = parseInt(process.env.TRUSTED_PROXY_COUNT ?? "1", 10);

/**
 * Extract the real client IP address from request headers.
 *
 * @param headers - Request headers object
 * @returns The extracted client IP, or null if unable to determine
 *
 * SECURITY: This function trusts only the Nth IP from the right in X-Forwarded-For,
 * where N is the configured number of trusted proxies. This prevents IP spoofing
 * attacks where malicious clients prepend fake IPs to the header.
 */
export function extractClientIP(headers: Headers): string | null {
  // X-Forwarded-For is the standard header set by proxies
  const xff = headers.get("x-forwarded-for");

  if (xff) {
    const ips = xff.split(",").map(ip => ip.trim()).filter(Boolean);

    if (ips.length > 0) {
      // Trust the IP that is TRUSTED_PROXY_COUNT positions from the right
      // If there are fewer IPs than expected, take the leftmost (most conservative)
      const clientIndex = Math.max(0, ips.length - TRUSTED_PROXY_COUNT);
      return ips[clientIndex] || null;
    }
  }

  // Fallback: Try X-Real-IP (set by some proxies like nginx)
  const xRealIP = headers.get("x-real-ip");
  if (xRealIP) {
    return xRealIP.trim();
  }

  // Fallback: CF-Connecting-IP for Cloudflare
  const cfConnectingIP = headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  return null;
}

/**
 * Stable bucket used when the client IP cannot be determined.
 * Shared on purpose — see the SECURITY note in extractClientIPForRateLimit.
 */
export const UNVERIFIED_IP_BUCKET = "ip:unverified";

/**
 * Extract a stable client IP key for IP-based rate limiting.
 *
 * SECURITY (D-3): This must FAIL CLOSED. A previous version returned a unique
 * per-request identifier (`unknown:<uuid>`) when the IP was undeterminable — that
 * silently DISABLED IP rate limiting (every attempt landed in its own bucket), so an
 * attacker on a deployment without `X-Forwarded-For` could brute force without limit.
 *
 * When the IP cannot be determined we instead return a single STABLE shared bucket so
 * unknown-IP traffic is collectively throttled. This is fail-closed; in a correctly
 * configured deployment (reverse proxy setting XFF, per TRUSTED_PROXY_COUNT) it is never
 * reached. Per-account (username) throttling is handled separately by the rate limiter,
 * so legitimate single-user logins are unaffected. Do NOT key this bucket on the username
 * — that would re-disable aggregate protection against credential-spraying across accounts.
 *
 * @param headers - Request headers object
 * @returns A stable client IP key, or the shared unverified-IP bucket.
 */
export function extractClientIPForRateLimit(headers: Headers): string {
  const ip = extractClientIP(headers);
  if (ip) {
    return ip;
  }

  // Fail closed: shared, stable bucket (never a unique-per-request key).
  return UNVERIFIED_IP_BUCKET;
}
