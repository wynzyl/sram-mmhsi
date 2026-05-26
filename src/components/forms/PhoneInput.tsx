"use client";

import type { ChangeEvent } from "react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { editorialFieldClass } from "@/lib/utils/editorial-styles";
import { formatPhoneInput, stripPhoneFormat } from "@/lib/utils/phone";

/** `editorial` matches the registrar wizard (see `frontend-design/Integration-Guide.md`). */
export type FormFieldVariant = "default" | "editorial";

export type PhoneInputProps = {
  /** Field label (displayed above input) */
  label: string;
  /** HTML name attribute (matches Zod schema key) */
  name: string;
  /** Whether field is required (shows asterisk) */
  required?: boolean;
  /** Current input value (controlled) - should be raw digits */
  value: string;
  /** Change handler - receives raw digits (stripped of formatting) */
  onChange: (value: string) => void;
  /** Field-level validation errors */
  error?: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Disable input */
  disabled?: boolean;
  /** Additional CSS classes for input */
  className?: string;
  /** Visual preset; default keeps legacy `form-control` styling. */
  variant?: FormFieldVariant;
};

/**
 * Reusable phone input field with automatic formatting for Philippine mobile numbers.
 * Formats as user types: 0917-010-0098 (4-3-4 hyphen-separated digits)
 *
 * @example
 * ```tsx
 * const [mobile, setMobile] = useState("");
 *
 * <PhoneInput
 *   label="Mobile Number"
 *   name="mobileNumber"
 *   required
 *   value={mobile}
 *   onChange={setMobile}
 *   error={state.errors?.mobileNumber}
 * />
 * ```
 */
export function PhoneInput({
  label,
  name,
  required = false,
  value,
  onChange,
  error,
  placeholder = "0917-010-0098",
  disabled = false,
  className,
  variant = "default",
}: PhoneInputProps) {
  // Display value is formatted, parent receives raw digits
  const [displayValue, setDisplayValue] = useState(() => formatPhoneInput(value));

  // Sync display value when parent value changes externally
  useEffect(() => {
    setDisplayValue(formatPhoneInput(value));
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setDisplayValue(formatted);
    // Pass stripped value to parent (for form submission and validation)
    onChange(stripPhoneFormat(formatted));
  };

  const isEditorial = variant === "editorial";
  const inputClassName = isEditorial
    ? editorialFieldClass({ invalid: Boolean(error?.length), className: cn("font-mono", className) })
    : cn(
        "form-control font-mono",
        error && "form-control-error",
        className
      );

  return (
    <div className={cn(!isEditorial && "form-group")}>
      <label
        className={isEditorial ? "mb-1.5 block text-sm font-medium text-foreground" : "form-label"}
        htmlFor={name}
      >
        {label}
        {required && (
          <span className={isEditorial ? "text-red-600" : "required"}>*</span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type="tel"
        inputMode="numeric"
        className={inputClassName}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={displayValue}
        onChange={handleChange}
        autoComplete="tel"
        aria-invalid={Boolean(error?.length)}
      />
      {error && (
        <p className={isEditorial ? "mt-1 text-sm text-red-600" : "form-error"}>{error[0]}</p>
      )}
    </div>
  );
}
