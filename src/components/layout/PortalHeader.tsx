"use client";

import Image from "next/image";
import { LogOut, ChevronDown } from "lucide-react";
import { logoutAction } from "@/features/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ColorThemePickerCompact } from "@/components/ui/ColorThemePicker";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type Role } from "@/lib/constants/roles";
import { cn } from "@/lib/utils/cn";

// ─── User Menu ─────────────────────────────────────────────────────────────

interface UserMenuProps {
  displayName: string;
  roleLabel: string;
}

function PortalUserMenu({ displayName, roleLabel }: UserMenuProps) {
  const truncatedName = displayName.length > 20 ? `${displayName.slice(0, 20)}...` : displayName;
  const initials = displayName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-lg",
            "hover:bg-muted transition-colors cursor-pointer",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="User menu"
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
            <p className="text-xs text-muted-foreground leading-tight">{roleLabel}</p>
          </div>

          <ChevronDown className="hidden sm:block size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[200px]">
        {/* Mobile: show name in dropdown since it's hidden in trigger */}
        <DropdownMenuLabel className="sm:hidden">
          <p className="text-sm font-medium text-foreground">{truncatedName}</p>
          <p className="text-xs text-muted-foreground font-normal">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="sm:hidden" />

        {/* Theme controls live in the header from sm up. Phones are the
            portal's primary device, so they are surfaced here rather than
            being unreachable. */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 sm:hidden">
          <span className="text-xs text-muted-foreground">Appearance</span>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <ColorThemePickerCompact />
          </div>
        </div>
        <DropdownMenuSeparator className="sm:hidden" />

        <DropdownMenuItem asChild variant="destructive">
          <form action={logoutAction} className="w-full">
            <button
              type="submit"
              className="flex w-full items-center gap-2 text-left"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── PortalHeader ─────────────────────────────────────────────────────────────

interface PortalHeaderProps {
  displayName: string;
  schoolYear?: string;
  /** Portal accounts are student or parent_guardian. Drives the shown label. */
  role?: Role;
}

/**
 * Simplified header for the Student Portal.
 * Optimized for mobile-first experience:
 * - No global search (students don't need it)
 * - Cleaner layout with essential controls only
 */
export function PortalHeader({
  displayName,
  schoolYear,
  role,
}: PortalHeaderProps) {
  const roleLabel = role ? ROLE_LABELS[role] : "Student";

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
            {roleLabel}
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
        <PortalUserMenu displayName={displayName} roleLabel={roleLabel} />
      </div>
    </header>
  );
}
