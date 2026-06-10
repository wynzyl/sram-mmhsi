import { useEffect } from "react";

type ModifierKey = "ctrl" | "meta" | "alt" | "shift";

interface UseHotkeyOptions {
  /** The key to listen for (e.g., "k", "p", "Escape") */
  key: string;
  /** Modifier keys required (e.g., ["ctrl"], ["meta"], or ["ctrl", "shift"]) */
  modifiers?: ModifierKey[];
  /** Callback function when hotkey is pressed */
  onTrigger: () => void;
  /** Whether the hotkey is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook to listen for keyboard shortcuts.
 * Supports Ctrl/Cmd+Key combinations with automatic cross-platform handling.
 *
 * @example
 * ```tsx
 * // Ctrl+K (Windows/Linux) or Cmd+K (Mac)
 * useHotkey({
 *   key: "k",
 *   modifiers: ["ctrl"],
 *   onTrigger: () => setOpen(true),
 * });
 * ```
 */
export function useHotkey({
  key,
  modifiers = [],
  onTrigger,
  enabled = true,
}: UseHotkeyOptions): void {
  useEffect(() => {
    // Early return if key is not provided or hook is disabled
    if (!enabled || !key) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Guard against undefined event.key (edge case in some browsers)
      if (!event.key) return;

      // Check if the pressed key matches (case-insensitive)
      if (event.key.toLowerCase() !== key.toLowerCase()) return;

      // Check modifier keys
      const hasCtrl = modifiers.includes("ctrl");
      const hasMeta = modifiers.includes("meta");
      const hasAlt = modifiers.includes("alt");
      const hasShift = modifiers.includes("shift");

      // For cross-platform support: treat Cmd (meta) on Mac same as Ctrl
      const ctrlOrMeta = hasCtrl || hasMeta;

      // Check other modifiers exactly
      const altMatch = hasAlt ? event.altKey : !event.altKey;
      const shiftMatch = hasShift ? event.shiftKey : !event.shiftKey;

      // If ctrl/meta is required, ensure at least one is pressed
      // If neither is in modifiers, ensure neither is pressed
      const ctrlMetaExact = ctrlOrMeta
        ? event.ctrlKey || event.metaKey
        : !event.ctrlKey && !event.metaKey;

      if (ctrlMetaExact && altMatch && shiftMatch) {
        event.preventDefault();
        onTrigger();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [key, modifiers, onTrigger, enabled]);
}
