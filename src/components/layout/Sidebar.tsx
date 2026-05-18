"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/features/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ROLE_LABELS, normalizeRole, ROLES } from "@/lib/constants/roles";
import { NAV_CONFIG } from "./sidebar-nav";
import type { Role } from "@/lib/constants/roles";
import type { NavIconName, NavItem } from "./sidebar-nav";
import "./sidebar.css";

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const ICONS: Record<NavIconName, React.ReactNode> = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  students: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  registrations: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  enrollments: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  subjects: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  assignments: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  "fee-schedules": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  booklets: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  ),
  assessments: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  "school-years": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  grades: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  payments: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  invoices: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  finance: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  "fee-item-types": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
};

// ─── Portal label helper ───────────────────────────────────────────────────────

function portalLabel(role: Role): string {
  if (role === "super_admin" || role === "admin") return "Admin Portal";
  if (role === "student" || role === "parent_guardian") return "Student Portal";
  return "Staff Portal";
}

function hrefPath(href: string): string {
  const i = href.indexOf("?");
  return i === -1 ? href : href.slice(0, i);
}

function hrefQuery(href: string): URLSearchParams | null {
  const i = href.indexOf("?");
  if (i === -1) return null;
  return new URLSearchParams(href.slice(i + 1));
}

function isNavActive(pathname: string, sp: URLSearchParams, item: NavItem): boolean {
  const path = hrefPath(item.href);
  const required = hrefQuery(item.href);

  if (item.pathMatch === "exact") {
    return pathname === path;
  }

  if (required) {
    if (pathname !== path) return false;
    for (const [k, v] of required.entries()) {
      if (sp.get(k) !== v) return false;
    }
    if (path === "/staff/students/new" && !required.has("intent")) {
      return !sp.get("intent");
    }
    return true;
  }

  if (pathname === path) {
    if (item.notActiveWhen && sp.get(item.notActiveWhen.param) === item.notActiveWhen.value) {
      return false;
    }
    return true;
  }
  return path !== "/" && pathname.startsWith(`${path}/`);
}

function isParentRegisterActive(pathname: string, sp: URLSearchParams, item: NavItem): boolean {
  if (!item.children?.length) return false;
  if (pathname === hrefPath(item.href)) return true;
  return item.children.some((c) => isNavActive(pathname, sp, c));
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  role: Role;
  username: string;
}

export function Sidebar({ role, username }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedRole = normalizeRole(role);
  const resolvedRole = normalizedRole ?? ROLES.ADMIN;
  const sections = normalizedRole ? NAV_CONFIG[normalizedRole] ?? [] : [];
  const usernameTitle =
    username.length > 28 ? `${username.slice(0, 28)}…` : username;

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <Image
          src="/MLAND LOGO.png"
          alt="Merryland logo"
          width={28}
          height={28}
          priority
          className="sidebar-brand-logo"
        />
        <div>
          <p className="sidebar-brand-name">MERRYLAND</p>
          <p className="sidebar-brand-portal">{portalLabel(resolvedRole)}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {sections.map((section) => (
          <div key={section.label} className="nav-section">
            <p className="nav-section-label">{section.label}</p>
            {section.items.map((item) => {
              if (item.children?.length) {
                const parentActive =
                  isParentRegisterActive(pathname, searchParams, item) ||
                  isNavActive(pathname, searchParams, item);
                return (
                  <div key={item.href} className="nav-item-group">
                    <Link
                      href={item.href}
                      className={`nav-link${parentActive ? " active" : ""}`}
                    >
                      {ICONS[item.icon]}
                      {item.label}
                    </Link>
                    <div className="nav-sublinks" role="group" aria-label={item.label}>
                      {item.children.map((child) => {
                        const subActive = isNavActive(pathname, searchParams, child);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`nav-sublink${subActive ? " active" : ""}`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const isActive = isNavActive(pathname, searchParams, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link${isActive ? " active" : ""}`}
                >
                  {ICONS[item.icon]}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Theme Toggle */}
      <div className="sidebar-theme">
        <ThemeToggle />
      </div>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar" aria-hidden="true">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <p className="user-name" title={usernameTitle}>
              {username}
            </p>
            <p className="user-role">{ROLE_LABELS[resolvedRole]}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="logout-btn" title="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
