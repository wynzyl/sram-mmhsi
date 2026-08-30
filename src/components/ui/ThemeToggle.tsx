"use client";

import { useTheme } from "@/components/providers/ThemeProvider";

/**
 * Theme toggle button for switching between light/dark modes
 * Displays current mode with icon and cycles through: light → dark → system
 */
export function ThemeToggle() {
  const { mode, setMode, mounted } = useTheme();

  const cycleMode = () => {
    if (mode === "light") setMode("dark");
    else if (mode === "dark") setMode("system");
    else setMode("light");
  };

  const getIcon = () => {
    if (mode === "light") {
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    } else if (mode === "dark") {
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    } else {
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    }
  };

  const getLabel = () => {
    if (mode === "light") return "Light";
    if (mode === "dark") return "Dark";
    return "System";
  };

  return (
    <button
      onClick={cycleMode}
      className="flex items-center gap-2 bg-muted border border-border px-2.5 py-1.5 rounded-md cursor-pointer text-muted-foreground text-xs font-medium transition-colors whitespace-nowrap hover:bg-muted hover:text-primary hover:border-border"
      title={mounted ? `Current mode: ${getLabel()} (click to cycle)` : undefined}
      aria-label={mounted ? `Switch mode (current: ${getLabel()})` : "Switch mode"}
      suppressHydrationWarning
    >
      <span suppressHydrationWarning>{mounted ? getIcon() : null}</span>
      <span className="text-xs min-w-[42px] text-left" suppressHydrationWarning>
        {mounted ? getLabel() : ""}
      </span>
    </button>
  );
}
