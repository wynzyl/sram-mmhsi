"use client";

import { useTheme } from "@/components/providers/ThemeProvider";

/**
 * Theme toggle button for switching between light/dark modes
 * Displays current theme with icon and cycles through: light → dark → system
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const getIcon = () => {
    if (theme === "light") {
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
    } else if (theme === "dark") {
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
    if (theme === "light") return "Light";
    if (theme === "dark") return "Dark";
    return "System";
  };

  return (
    <button
      onClick={cycleTheme}
      className="theme-toggle-btn"
      title={`Current theme: ${getLabel()} (click to cycle)`}
      aria-label={`Switch theme (current: ${getLabel()})`}
    >
      {getIcon()}
      <span className="theme-toggle-label">{getLabel()}</span>

      <style jsx>{`
        .theme-toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          padding: 0.375rem 0.625rem;
          border-radius: var(--radius);
          cursor: pointer;
          color: var(--color-text-2);
          font-size: 0.75rem;
          font-weight: 500;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .theme-toggle-btn:hover {
          background: var(--color-surface-3);
          color: var(--color-primary);
          border-color: var(--color-border-2);
        }
        .theme-toggle-label {
          font-size: 0.75rem;
          min-width: 42px;
          text-align: left;
        }
      `}</style>
    </button>
  );
}
