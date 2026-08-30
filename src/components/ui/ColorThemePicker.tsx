"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import {
  COLOR_THEMES,
  COLOR_THEME_LABELS,
  COLOR_THEME_COLORS,
  type ColorTheme,
} from "@/lib/constants/color-themes";

/**
 * Visual color theme picker showing color swatches for each available theme.
 * Works independently from the light/dark mode toggle.
 */
export function ColorThemePicker() {
  const { colorTheme, setColorTheme, mounted } = useTheme();

  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color theme">
      {COLOR_THEMES.map((theme) => (
        <button
          key={theme}
          type="button"
          role="radio"
          aria-checked={colorTheme === theme}
          onClick={() => setColorTheme(theme)}
          className={`
            relative w-6 h-6 rounded-full border-2 transition-all duration-150 shadow-sm
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            ${
              colorTheme === theme
                ? "border-foreground scale-110 ring-2 ring-foreground/20"
                : "border-white/25 hover:scale-105 hover:border-foreground/50"
            }
          `}
          style={{ backgroundColor: COLOR_THEME_COLORS[theme] }}
          title={COLOR_THEME_LABELS[theme]}
          aria-label={`${COLOR_THEME_LABELS[theme]} theme`}
          suppressHydrationWarning
        >
          {/* Checkmark indicator for selected theme */}
          {mounted && colorTheme === theme && (
            <span className="absolute inset-0 flex items-center justify-center">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-sm"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Labeled version of the color theme picker with a header.
 * Useful for settings pages or modals.
 */
export function ColorThemePickerLabeled() {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Color Theme
      </span>
      <ColorThemePicker />
    </div>
  );
}

/**
 * Compact dropdown-style picker that shows the current theme and opens a menu.
 * Shows current theme color as a small indicator.
 */
export function ColorThemePickerCompact() {
  const { colorTheme, setColorTheme, mounted } = useTheme();

  const cycleTheme = () => {
    const currentIndex = COLOR_THEMES.indexOf(colorTheme);
    const nextIndex = (currentIndex + 1) % COLOR_THEMES.length;
    setColorTheme(COLOR_THEMES[nextIndex] as ColorTheme);
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="flex items-center gap-2 bg-muted border border-border px-2.5 py-1.5 rounded-md cursor-pointer text-muted-foreground text-xs font-medium transition-colors whitespace-nowrap hover:bg-muted/70 hover:text-primary hover:border-border"
      title={mounted ? `Current theme: ${COLOR_THEME_LABELS[colorTheme]} (click to cycle)` : undefined}
      aria-label={mounted ? `Color theme: ${COLOR_THEME_LABELS[colorTheme]}` : "Color theme"}
      suppressHydrationWarning
    >
      <span
        className="w-3.5 h-3.5 rounded-full border border-border"
        style={{ backgroundColor: mounted ? COLOR_THEME_COLORS[colorTheme] : undefined }}
        suppressHydrationWarning
      />
      <span className="text-xs min-w-[48px] text-left" suppressHydrationWarning>
        {mounted ? COLOR_THEME_LABELS[colorTheme] : ""}
      </span>
    </button>
  );
}
