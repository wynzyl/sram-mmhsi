"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  COLOR_THEMES,
  COLOR_THEME_STORAGE_KEY,
  type ColorTheme,
} from "@/lib/constants/color-themes";

type Mode = "light" | "dark" | "system";

interface ThemeContextType {
  /** Current mode preference (light/dark/system) */
  mode: Mode;
  /** Set the mode preference */
  setMode: (mode: Mode) => void;
  /** Current color theme (default/ocean/forest/purple) */
  colorTheme: ColorTheme;
  /** Set the color theme */
  setColorTheme: (theme: ColorTheme) => void;
  /** Whether the component has mounted (for hydration safety) */
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getResolvedMode(mode: Mode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

/**
 * Applies the color theme class to the document root
 * Removes any existing theme-* classes before applying the new one
 */
function applyColorThemeClass(theme: ColorTheme) {
  const root = document.documentElement;
  // Remove all existing theme classes
  COLOR_THEMES.forEach((t) => {
    if (t !== "default") {
      root.classList.remove(`theme-${t}`);
    }
  });
  // Apply new theme class (skip for default)
  if (theme !== "default") {
    root.classList.add(`theme-${theme}`);
  }
}

/**
 * Theme provider for managing light/dark mode AND color themes
 *
 * The inline script in layout.tsx handles initial DOM state (no flash).
 * This provider syncs React state with localStorage and handles user changes.
 *
 * IMPORTANT: useState must initialize with constant values to avoid
 * hydration mismatch between server (no localStorage) and client (has localStorage).
 * The actual stored values are synced via useEffect after hydration completes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with constant values to avoid hydration mismatch
  // Server and client both render with these initially
  const [mode, setModeState] = useState<Mode>("system");
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("default");
  const [mounted, setMounted] = useState(false);

  // Sync with localStorage after hydration completes
  useEffect(() => {
    const storedMode = localStorage.getItem("theme") as Mode | null;
    if (storedMode && ["light", "dark", "system"].includes(storedMode)) {
      setModeState(storedMode); // eslint-disable-line react-hooks/set-state-in-effect -- Init from localStorage
    }

    const storedColorTheme = localStorage.getItem(
      COLOR_THEME_STORAGE_KEY
    ) as ColorTheme | null;
    if (
      storedColorTheme &&
      (COLOR_THEMES as readonly string[]).includes(storedColorTheme)
    ) {
      setColorThemeState(storedColorTheme); // eslint-disable-line react-hooks/set-state-in-effect -- Init from localStorage
    }

    setMounted(true);
  }, []);

  // User-triggered mode change: update DOM, localStorage, and React state
  const setMode = useCallback((newMode: Mode) => {
    setModeState(newMode);

    const root = document.documentElement;
    const resolved = getResolvedMode(newMode);

    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
    localStorage.setItem("theme", newMode);
  }, []);

  // User-triggered color theme change: update DOM, localStorage, and React state
  const setColorTheme = useCallback((newTheme: ColorTheme) => {
    setColorThemeState(newTheme);
    applyColorThemeClass(newTheme);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, newTheme);
  }, []);

  // Listen for system preference changes when mode is "system"
  useEffect(() => {
    if (mode !== "system") return;

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
  }, [mode]);

  return (
    <ThemeContext.Provider
      value={{ mode, setMode, colorTheme, setColorTheme, mounted }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 * Returns current mode, color theme, and setter functions
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
