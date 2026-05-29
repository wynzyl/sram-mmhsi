"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getResolvedTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

/**
 * Theme provider for managing light/dark mode
 *
 * The inline script in layout.tsx handles initial DOM state (no flash).
 * This provider syncs React state with localStorage and handles user changes.
 *
 * IMPORTANT: useState must initialize with a constant value ("system") to avoid
 * hydration mismatch between server (no localStorage) and client (has localStorage).
 * The actual stored theme is synced via useEffect after hydration completes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with constant value to avoid hydration mismatch
  // Server and client both render with "system" initially
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // Sync with localStorage after hydration completes
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    if (storedTheme && ["light", "dark", "system"].includes(storedTheme)) {
      setThemeState(storedTheme);
    }
    setMounted(true);
  }, []);

  // User-triggered theme change: update DOM, localStorage, and React state
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);

    const root = document.documentElement;
    const resolved = getResolvedTheme(newTheme);

    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
    localStorage.setItem("theme", newTheme);
  }, []);

  // Listen for system preference changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const resolved = mediaQuery.matches ? "dark" : "light";
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
      root.style.colorScheme = resolved;
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 * Returns current theme and setTheme function
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
