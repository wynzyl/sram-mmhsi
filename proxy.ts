import { NextRequest, NextResponse } from "next/server";
import { decryptSessionJwt, SESSION_COOKIE_NAME, SESSION_INVALID_PARAM } from "@/lib/auth/session-token";
import { ROLES, STAFF_ROLES, PORTAL_ROLES, ROLE_LANDING, normalizeRole } from "@/lib/constants/roles";

// Header name for request correlation ID (used for distributed tracing)
const CORRELATION_ID_HEADER = "x-correlation-id";

// /api/health and /api/readiness are container probes (Dockerfile HEALTHCHECK).
// They must bypass auth: without this the proxy 302s them to /login, wget
// follows the redirect and the healthcheck "passes" without ever reaching the
// probe route (readiness would never run its SELECT 1). Neither returns data.
const PUBLIC_ROUTES = ["/login", "/api/health", "/api/readiness"];
const PASSWORD_CHANGE_ROUTE = "/change-password";

const STAFF_PREFIXES = ["/admin", "/staff"];

const PORTAL_PREFIXES = ["/portal"];

const ADMIN_PREFIXES = ["/admin"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Generate or forward correlation ID for request tracing
  const correlationId = req.headers.get(CORRELATION_ID_HEADER) ?? crypto.randomUUID();

  const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const isStaffRoute = STAFF_PREFIXES.some((p) => pathname.startsWith(p));
  const isPortalRoute = PORTAL_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session: Awaited<ReturnType<typeof decryptSessionJwt>> | null = null;
  if (token) {
    try {
      session = await decryptSessionJwt(token);
    } catch {
      // Invalid / expired token — treat as unauthenticated
      session = null;
    }
  }

  const isAuthenticated = !!session;
  const role = normalizeRole(session?.role);

  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // SECURITY FIX (A-1): Handle broken/zombie sessions BEFORE public route redirect
  // A valid JWT token with an unusable role (null after normalization) indicates
  // a corrupted or outdated session. Clear the cookie and allow login.
  if (isAuthenticated && !role) {
    if (isPublic) {
      // On public route (e.g., /login): clear stale cookie, let them proceed
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
    // On protected route: redirect to login with cleared cookie
    const res = NextResponse.redirect(new URL("/login", req.nextUrl));
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  // Authenticated user on public route → send to role's landing page
  // (role is guaranteed valid at this point due to the check above)
  if (isAuthenticated && isPublic && role) {
    // Loop-breaker: the server layer (requireSession / layout user check) redirects
    // here with ?session_invalid=1 when the JWT is valid but its DB session/user is
    // gone. The proxy can't see the DB, so it trusts that signal — clear the cookie
    // and let /login render instead of bouncing back to the landing page (which would
    // redirect here again → infinite loop / blank flickering page).
    //
    // Also handle ?passwordChanged=true: after a successful password change, the
    // server deletes the DB session but the browser still has the old JWT cookie.
    // Without this check, proxy would redirect to landing page → requireSession()
    // fails (orphaned JWT) → error page. Clear the cookie and let /login render.
    const isSessionInvalid = req.nextUrl.searchParams.has(SESSION_INVALID_PARAM);
    const isPasswordChanged = req.nextUrl.searchParams.has("passwordChanged");

    if (isSessionInvalid || isPasswordChanged) {
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
    return NextResponse.redirect(new URL(ROLE_LANDING[role], req.nextUrl));
  }

  if (isAuthenticated && role && isStaffRoute && PORTAL_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/portal/dashboard", req.nextUrl));
  }

  if (isAuthenticated && role && isPortalRoute && STAFF_ROLES.includes(role)) {
    const landing = ROLE_LANDING[role] ?? "/staff/dashboard";
    return NextResponse.redirect(new URL(landing, req.nextUrl));
  }

  if (
    isAuthenticated &&
    role &&
    isAdminRoute &&
    role !== ROLES.SUPER_ADMIN &&
    role !== ROLES.ADMIN
  ) {
    const landing = ROLE_LANDING[role] ?? "/login";
    return NextResponse.redirect(new URL(landing, req.nextUrl));
  }

  // SECURITY: Force password change gate - redirect users who need to change password
  // Allow access to change-password page and logout action, redirect everything else
  if (
    isAuthenticated &&
    session?.forcePasswordChange &&
    pathname !== PASSWORD_CHANGE_ROUTE &&
    !pathname.startsWith("/api/auth/logout")
  ) {
    return NextResponse.redirect(new URL(PASSWORD_CHANGE_ROUTE, req.nextUrl));
  }

  // Add correlation ID to response headers for tracing
  const response = NextResponse.next();
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}
