"use client";

import Image from "next/image";
import { logoutAction } from "@/features/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ColorThemePickerCompact } from "@/components/ui/ColorThemePicker";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils/cn";

// ─── Icons ─────────────────────────────────────────────────────────────────

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
  displayName: string;
}

function PortalUserMenu({ displayName }: UserMenuProps) {
  const truncatedName = displayName.length > 20 ? `${displayName.slice(0, 20)}...` : displayName;
  const initials = displayName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

        {/* Name */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-foreground leading-tight">{truncatedName}</p>
          <p className="text-xs text-muted-foreground leading-tight">Student</p>
        </div>

        <ChevronDownIcon className="hidden sm:block text-muted-foreground" />
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
        <div className="px-3 py-2 border-b border-border sm:hidden">
          <p className="text-sm font-medium text-foreground">{truncatedName}</p>
          <p className="text-xs text-muted-foreground">Student</p>
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

// ─── PortalHeader ─────────────────────────────────────────────────────────────

interface PortalHeaderProps {
  displayName: string;
  schoolYear?: string;
}

/**
 * Simplified header for the Student Portal.
 * Optimized for mobile-first experience:
 * - No global search (students don't need it)
 * - Cleaner layout with essential controls only
 */
export function PortalHeader({ displayName, schoolYear }: PortalHeaderProps) {
  return (
    <header
      className={cn(
        "h-14 sm:h-16 shrink-0 sticky top-0 z-40",
        "bg-sidebar border-b border-border",
        "flex items-center justify-between gap-3 px-3 sm:px-4"
      )}
    >
      {/* Left: Sidebar Toggle + Brand */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Image
          src="/MLAND LOGO.png"
          alt="Merryland logo"
          width={28}
          height={28}
          priority
          className="shrink-0"
        />
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-base sm:text-lg text-primary tracking-wide">
            MERRYLAND
          </span>
          <span
            className={cn(
              "hidden sm:inline-block px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
              "bg-primary/10 text-primary rounded-md"
            )}
          >
            Student
          </span>
        </div>
        {schoolYear && (
          <div className="hidden md:flex items-center gap-2 ml-2 pl-3 border-l border-border">
            <span className="text-xs text-muted-foreground">School Year</span>
            <span className="text-xs font-medium text-foreground">{schoolYear}</span>
          </div>
        )}
      </div>

      {/* Right: Theme + User Menu */}
      <div className="flex items-center gap-1">
        {/* Theme controls - hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-1.5 pr-2 mr-2 border-r border-border">
          <ThemeToggle />
          <ColorThemePickerCompact />
        </div>

        {/* User menu */}
        <PortalUserMenu displayName={displayName} />
      </div>
    </header>
  );
}
