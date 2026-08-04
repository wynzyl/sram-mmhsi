"use client";

import { cn } from "@/lib/utils/cn";

interface ToggleSwitchProps {
  /** Hidden field name for form submission */
  name: string;
  /** Whether the toggle is on */
  checked: boolean;
  /** Callback when toggle state changes */
  onChange: (checked: boolean) => void;
  /** Label text displayed next to the toggle */
  label: string;
  /** Optional description text below the label */
  description?: string;
  /** Custom color when checked (default: primary) */
  checkedColor?: "primary" | "success" | "blue" | "amber";
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Optional id for the toggle button */
  id?: string;
}

const colorClasses = {
  primary: "bg-primary border-primary",
  success: "bg-success border-success",
  blue: "bg-blue-500 border-blue-500",
  amber: "bg-amber-500 border-amber-500",
} as const;

/**
 * A reusable toggle switch component with hidden input for form submission.
 *
 * @example
 * ```tsx
 * <ToggleSwitch
 *   name="isActive"
 *   checked={isActive}
 *   onChange={setIsActive}
 *   label="Active"
 *   description="Whether this item is available for selection"
 * />
 * ```
 */
export function ToggleSwitch({
  name,
  checked,
  onChange,
  label,
  description,
  checkedColor = "primary",
  disabled = false,
  id,
}: ToggleSwitchProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <input
        type="hidden"
        name={name}
        value={checked ? "true" : "false"}
      />
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "relative w-10 h-6 rounded-full border cursor-pointer shrink-0 transition-colors",
          checked ? colorClasses[checkedColor] : "bg-muted border-border",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
            checked && "translate-x-4"
          )}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default ToggleSwitch;
