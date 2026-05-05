import { NextRequest, NextResponse } from "next/server";
import { decryptSession } from "@/lib/auth/session";
import type { Role } from "@/lib/constants/roles";
import { STAFF_ROLES, PORTAL_ROLES } from "@/lib/constants/roles";

// ─── Route Groups ─────────────────────────────────────────────────────────────

const PUBLIC_ROUTES = ["/login"];

// Staff-only prefixes
const STAFF_PREFIXES = ["/admin", "/staff"];
// Portal-only prefixes
const PORTAL_PREFIXES = ["/portal"];

// Admin-only prefix
const ADMIN_PREFIXES = ["/admin"];

// ─── Role → landing page (for redirect after login) ───────────────────────────

const ROLE_LANDING: Record<Role, string> = {
  admin: "/admin/dashboard",
  registrar: "/staff/dashboard",
  finance_officer: "/staff/finance",
  cashier: "/staff/payments",
  teacher: "/staff/grades",
  student: "/portal/dashboard",
  parent_guardian: "/portal/dashboard",
};

// ─── Proxy ────────────────────────────────────────────────────────────────────

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const isStaffRoute = STAFF_PREFIXES.some((p) => pathname.startsWith(p));
  const isPortalRoute = PORTAL_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  // Read the session cookie (optimistic check — no DB hit in proxy)
  const token = req.cookies.get("srams_session")?.value;
  const session = token ? await decryptSession(token) : null;

  const isAuthenticated = !!session;
  const role = session?.role as Role | undefined;

  // 1. Unauthenticated → redirect to login for any protected route
  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated user hitting login → redirect to their landing page
  if (isAuthenticated && isPublic) {
    const landing = role ? ROLE_LANDING[role] : "/login";
    return NextResponse.redirect(new URL(landing, req.nextUrl));
  }

  // 3. Portal user trying to access staff routes → 403 redirect
  if (isAuthenticated && isStaffRoute && role && PORTAL_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/portal/dashboard", req.nextUrl));
  }

  // 4. Staff user trying to access portal routes → redirect to staff landing
  if (isAuthenticated && isPortalRoute && role && STAFF_ROLES.includes(role)) {
    const landing = ROLE_LANDING[role] ?? "/staff/dashboard";
    return NextResponse.redirect(new URL(landing, req.nextUrl));
  }

  // 5. Non-admin trying to access admin routes
  if (isAuthenticated && isAdminRoute && role !== "admin") {
    const landing = ROLE_LANDING[role!] ?? "/login";
    return NextResponse.redirect(new URL(landing, req.nextUrl));
  }

  return NextResponse.next();
}

// Run on all routes except Next.js internals, static files, and API routes
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};
