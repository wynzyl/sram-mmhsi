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
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer reads localStorage synchronously on first render
  // This matches what the inline script read, avoiding state mismatch
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as Theme) || "system";
  });

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
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
