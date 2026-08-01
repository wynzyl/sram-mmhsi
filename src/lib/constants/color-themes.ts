/**
 * Color Theme Constants
 *
 * Defines the available color themes for the application.
 * Each theme works with both light and dark modes.
 */

export const COLOR_THEMES = ["default", "cosmic", "slate", "graphite"] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

/**
 * Human-readable labels for each color theme
 */
export const COLOR_THEME_LABELS: Record<ColorTheme, string> = {
  default: "Crimson",
  cosmic: "Cosmic",
  slate: "Slate",
  graphite: "Graphite",
};

/**
 * Preview colors for the theme picker UI (primary color of each theme)
 */
export const COLOR_THEME_COLORS: Record<ColorTheme, string> = {
  default: "#db0000",
  cosmic: "#6e56cf",
  slate: "#6366f1",
  graphite: "#909090",
};

/**
 * Storage key for color theme preference
 */
export const COLOR_THEME_STORAGE_KEY = "colorTheme";
