"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
  disabled: boolean;
  errors?: string[];
  /** Guidance shown above the input, e.g. a date-of-birth format. */
  hint?: ReactNode;
  /** Guidance shown below the input, e.g. the complexity rule. */
  footnote?: ReactNode;
  /** Right-aligned slot beside the label, e.g. a "Forgot password?" link. */
  labelEnd?: ReactNode;
}

/**
 * One labelled password input with a show/hide toggle.
 *
 * Shared by the login and both change-password forms, which previously
 * repeated this block (with hand-hex styling) up to three times each.
 */
export function PasswordField({
  id,
  label,
  autoComplete,
  placeholder,
  disabled,
  errors,
  hint,
  footnote,
  labelEnd,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = hint || footnote ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {labelEnd ? (
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id}>{label}</Label>
          {labelEnd}
        </div>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}

      {hint ? (
        <p id={hintId} className="text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}

      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          error={Boolean(errors?.length)}
          placeholder={placeholder}
          className="h-11 pr-11"
          aria-describedby={
            [errors?.length ? errorId : null, hintId].filter(Boolean).join(" ") ||
            undefined
          }
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {errors?.length ? (
        <p id={errorId} role="alert" className="text-xs leading-snug text-destructive">
          {errors[0]}
        </p>
      ) : null}

      {footnote ? (
        <p className="text-xs leading-snug text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  );
}
