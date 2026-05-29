"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Configuration for an optional input field in the confirmation UI.
 */
export interface InlineConfirmInputConfig {
  /** Input name attribute (for form submission) */
  name: string;
  /** Placeholder text */
  placeholder: string;
  /** Current input value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Whether the input is required */
  required?: boolean;
}

/**
 * Props for the InlineConfirmButtons component.
 */
export interface InlineConfirmButtonsProps {
  /** Label for the confirm button. @default "Confirm" */
  confirmLabel?: string;
  /** Label for the cancel button. @default "Cancel" */
  cancelLabel?: string;
  /** Whether the confirm action is loading */
  isLoading?: boolean;
  /** Button variant for the confirm button. @default "danger" */
  variant?: "danger" | "success" | "primary";
  /** Optional prompt text shown before buttons */
  prompt?: string;
  /** Callback when confirm is clicked (for non-form usage) */
  onConfirm?: () => void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Optional input field configuration (for forms requiring reason/remarks) */
  inputConfig?: InlineConfirmInputConfig;
}

/**
 * Presentational component for inline confirmation UI.
 *
 * Use this component with the `useInlineConfirm` hook for a complete
 * inline confirmation pattern.
 *
 * Supports two modes:
 * 1. Simple confirmation (just confirm/cancel buttons)
 * 2. Confirmation with input (e.g., for entering a reason)
 *
 * @example Simple confirmation
 * ```tsx
 * <InlineConfirmButtons
 *   prompt="Delete this item?"
 *   onConfirm={handleDelete}
 *   onCancel={() => setConfirming(false)}
 *   isLoading={isPending}
 * />
 * ```
 *
 * @example With input field (wrap in form for submission)
 * ```tsx
 * <form action={submitAction}>
 *   <InlineConfirmButtons
 *     inputConfig={{
 *       name: "reason",
 *       placeholder: "Enter reason",
 *       value: inputValue,
 *       onChange: setInputValue,
 *       required: true,
 *     }}
 *     confirmLabel="Submit"
 *     onCancel={() => setConfirming(false)}
 *     isLoading={isPending}
 *   />
 * </form>
 * ```
 */
export function InlineConfirmButtons({
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  variant = "danger",
  prompt,
  onConfirm,
  onCancel,
  inputConfig,
}: InlineConfirmButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {inputConfig && (
        <Input
          type="text"
          name={inputConfig.name}
          placeholder={inputConfig.placeholder}
          value={inputConfig.value}
          onChange={(e) => inputConfig.onChange(e.target.value)}
          required={inputConfig.required}
          className="h-8 w-36 text-xs"
        />
      )}

      {prompt && (
        <span className="text-xs text-muted-foreground">{prompt}</span>
      )}

      <Button
        type={onConfirm ? "button" : "submit"}
        variant={variant}
        size="sm"
        loading={isLoading}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
      >
        {cancelLabel}
      </Button>
    </div>
  );
}

/**
 * Trigger button component to show the inline confirmation UI.
 *
 * A simple button that triggers showing the confirmation state.
 * Use this for consistency with InlineConfirmButtons styling.
 */
export interface InlineConfirmTriggerProps {
  /** Button label */
  label: string;
  /** Button variant. @default "danger" */
  variant?: "danger" | "danger-outline" | "success" | "primary" | "secondary";
  /** Callback when clicked */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
}

export function InlineConfirmTrigger({
  label,
  variant = "danger-outline",
  onClick,
  disabled = false,
}: InlineConfirmTriggerProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}
