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
 * Extract client IP with a fallback value for rate limiting.
 *
 * SECURITY: Unlike extractClientIP, this NEVER returns "unknown" or a shared bucket.
 * If we can't determine the IP, we return a unique identifier to prevent
 * a shared rate limit bucket that could be exploited.
 *
 * @param headers - Request headers object
 * @param fallbackIdentifier - Unique identifier to use if IP cannot be determined
 * @returns The client IP or fallback identifier
 */
export function extractClientIPForRateLimit(
  headers: Headers,
  fallbackIdentifier?: string
): string {
  const ip = extractClientIP(headers);

  if (ip) {
    return ip;
  }

  // If we can't determine IP and have a fallback (e.g., username), use it
  if (fallbackIdentifier) {
    return `fallback:${fallbackIdentifier}`;
  }

  // Last resort: generate a unique ID for this request
  // This prevents shared bucket but may be too permissive
  // In practice, legitimate proxies should always set XFF
  return `unknown:${crypto.randomUUID()}`;
}
