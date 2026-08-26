"use client";

import Image from "next/image";
import { logoutAction } from "@/features/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ColorThemePickerCompact } from "@/components/ui/ColorThemePicker";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCommandPalette } from "@/components/command-palette";
import { ROLE_LABELS, type Role } from "@/lib/constants/roles";
import { cn } from "@/lib/utils/cn";

// ─── Icons ─────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── User Menu ─────────────────────────────────────────────────────────────

interface UserMenuProps {
  username: string;
  role: Role;
}

function UserMenu({ username, role }: UserMenuProps) {
  const displayName = username.length > 20 ? `${username.slice(0, 20)}...` : username;
  const initials = username.charAt(0).toUpperCase();

  return (
    <div className="relative group">
      <button
        type="button"
        className={cn(
          "flex items-center gap-2.5 px-2 py-1.5 rounded-lg",
          "hover:bg-muted transition-colors cursor-pointer",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label="User menu"
        aria-haspopup="true"
      >
        {/* Avatar */}
        <div className="relative">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              "bg-gradient-to-br from-primary to-primary/80",
              "text-white text-sm font-bold"
            )}
          >
            {initials}
          </div>
          {/* Online indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-card" />
        </div>

        {/* Name and role */}
        <div className="hidden lg:block text-left">
          <p className="text-sm font-medium text-foreground leading-tight">{displayName}</p>
          <p className="text-xs text-muted-foreground leading-tight">{ROLE_LABELS[role]}</p>
        </div>

        <ChevronDownIcon className="hidden lg:block text-muted-foreground" />
      </button>

      {/* Dropdown menu */}
      <div
        className={cn(
          "absolute right-0 top-full mt-1 min-w-[200px] py-1",
          "bg-popover border border-border rounded-lg shadow-lg",
          "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
          "transition-all duration-150 z-50"
        )}
      >
        <div className="px-3 py-2 border-b border-border lg:hidden">
          <p className="text-sm font-medium text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
              "text-muted-foreground hover:text-destructive hover:bg-muted",
              "transition-colors"
            )}
          >
            <LogoutIcon />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── AppHeader ─────────────────────────────────────────────────────────────

function portalLabel(role: Role): string {
  if (role === "super_admin" || role === "admin") return "Admin Portal";
  if (role === "student" || role === "parent_guardian") return "Student Portal";
  return "Staff Portal";
}

interface AppHeaderProps {
  username: string;
  role: Role;
  schoolYear?: string;
}

export function AppHeader({ username, role, schoolYear }: AppHeaderProps) {
  const { open: openCommandPalette } = useCommandPalette();
  const portal = portalLabel(role);

  return (
    <header
      className={cn(
        "h-16 shrink-0 sticky top-0 z-40",
        "bg-sidebar border-b border-border",
        "flex items-center justify-between gap-4 px-4"
      )}
    >
      {/* Left: Sidebar Toggle + Brand */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Image
          src="/MLAND LOGO.png"
          alt="Merryland logo"
          width={32}
          height={32}
          priority
          className="shrink-0"
        />
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-lg text-primary tracking-wide">MERRYLAND</span>
          <span
            className={cn(
              "px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
              "bg-primary/10 text-primary rounded-md"
            )}
          >
            {portal.replace(" Portal", "")}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-2 pl-3 border-l border-border">
          <span className="text-xs text-muted-foreground">{portal}</span>
          {schoolYear && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-xs font-medium text-foreground">{schoolYear}</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md hidden sm:block">
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2",
            "bg-muted border border-border rounded-lg",
            "text-muted-foreground text-sm cursor-pointer",
            "hover:bg-muted/80 hover:border-border hover:text-foreground",
            "transition-colors"
          )}
          aria-label="Open search"
        >
          <SearchIcon />
          <span className="flex-1 text-left">Search...</span>
          <kbd
            className={cn(
              "hidden md:inline-block font-mono text-[0.65rem]",
              "px-1.5 py-0.5 bg-background border border-border rounded",
              "text-muted-foreground"
            )}
          >
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Mobile search button */}
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            "sm:hidden p-2 rounded-lg",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors"
          )}
          aria-label="Search"
        >
          <SearchIcon />
        </button>

        {/* Theme controls */}
        <div className="hidden md:flex items-center gap-1.5 pr-2 mr-2 border-r border-border">
          <ThemeToggle />
          <ColorThemePickerCompact />
        </div>

        {/* Notifications */}
        <button
          type="button"
          className={cn(
            "relative p-2 rounded-lg",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors"
          )}
          aria-label="Notifications"
        >
          <BellIcon />
          {/* Notification badge - placeholder */}
          <span
            className={cn(
              "absolute top-1.5 right-1.5 w-2 h-2",
              "bg-destructive rounded-full",
              "animate-pulse"
            )}
          />
        </button>

        {/* User menu */}
        <UserMenu username={username} role={role} />
      </div>
    </header>
  );
}
