import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils/cn";

/**
 * Shared classes for text inputs, selects, and textareas in the editorial registration theme.
 * Use with `cn(editorialFieldClass(...), extra)` or pass `className` for mono / read-only surfaces.
 *
 * @see `input-editorial` in globals.css for the same styling outside TS (raw HTML).
 */
export function editorialFieldClass(options?: {
  /** When true, apply error border + focus ring (e.g. after validation). */
  invalid?: boolean;
  className?: ClassValue;
}) {
  const { invalid, className } = options ?? {};
  return cn("form-control", invalid && "form-control-error", className);
}
