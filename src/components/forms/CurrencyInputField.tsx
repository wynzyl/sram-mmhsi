"use client";

import { useState, useEffect, type ChangeEvent, type FocusEvent } from "react";
import { formatCurrency, parseCurrency } from "@/lib/utils/currency";

export type CurrencyInputFieldProps = {
  /** Field label (displayed above input) */
  label: string;
  /** HTML name attribute (matches Zod schema key) */
  name: string;
  /** Whether field is required (shows asterisk) */
  required?: boolean;
  /** Current value (numeric amount) */
  value: number | string;
  /** Change handler (receives numeric value) */
  onChange: (value: number) => void;
  /** Field-level validation errors */
  error?: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Disable input */
  disabled?: boolean;
  /** Additional CSS classes for input */
  className?: string;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
};

/**
 * Currency input field with PHP formatting.
 * Formats as currency on blur, allows numeric input during editing.
 * Replaces custom currency input patterns in forms.
 *
 * @example
 * ```tsx
 * const [amount, setAmount] = useState(0);
 *
 * <CurrencyInputField
 *   label="Amount"
 *   name="amount"
 *   required
 *   value={amount}
 *   onChange={setAmount}
 *   error={state.errors?.amount}
 *   min={0}
 * />
 * ```
 */
export function CurrencyInputField({
  label,
  name,
  required = false,
  value,
  onChange,
  error,
  placeholder = "0.00",
  disabled = false,
  className,
  min,
  max,
}: CurrencyInputFieldProps) {
  // Track internal display value (formatted vs numeric)
  const [displayValue, setDisplayValue] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);

  // Initialize display value from prop
  useEffect(() => {
    if (!isFocused) {
      const numericValue = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(numericValue) && numericValue > 0) {
        setDisplayValue(formatCurrency(numericValue));
      } else {
        setDisplayValue("");
      }
    }
  }, [value, isFocused]);

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Convert to plain number for editing
    const numericValue = parseCurrency(displayValue);
    if (numericValue > 0) {
      setDisplayValue(String(numericValue));
    } else {
      setDisplayValue("");
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    // Format as currency
    const numericValue = parseFloat(e.target.value);
    if (!isNaN(numericValue) && numericValue > 0) {
      setDisplayValue(formatCurrency(numericValue));
      onChange(numericValue);
    } else {
      setDisplayValue("");
      onChange(0);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setDisplayValue(rawValue);

    // Parse numeric value for onChange (but don't format yet)
    const numericValue = parseFloat(rawValue);
    if (!isNaN(numericValue)) {
      onChange(numericValue);
    }
  };

  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const rawValue = !isNaN(numericValue) && numericValue > 0 ? numericValue : "";

  const inputClassName = `form-control ${error ? "form-control-error" : ""} ${className ?? ""}`.trim();

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          ₱
        </span>
        {/* Hidden input carries the raw numeric value for form submission */}
        <input type="hidden" name={name} value={rawValue} />
        <input
          id={name}
          type="text"
          inputMode="decimal"
          className={`${inputClassName} pl-8`}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          min={min}
          max={max}
        />
      </div>
      {error && <p className="form-error">{error[0]}</p>}
    </div>
  );
}

/**
 * Simple numeric currency input (no formatting).
 * Use when you need a raw number input styled as currency.
 *
 * @example
 * ```tsx
 * <SimpleCurrencyInputField
 *   label="Amount"
 *   name="amount"
 *   value={amount}
 *   onChange={setAmount}
 *   min={0}
 *   step={0.01}
 * />
 * ```
 */
export function SimpleCurrencyInputField({
  label,
  name,
  required = false,
  value,
  onChange,
  error,
  placeholder = "0.00",
  disabled = false,
  className,
  min,
  max,
  step = 0.01,
}: CurrencyInputFieldProps & { step?: number }) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseFloat(e.target.value);
    onChange(isNaN(numericValue) ? 0 : numericValue);
  };

  const inputClassName = `form-control ${error ? "form-control-error" : ""} ${className ?? ""}`.trim();

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          ₱
        </span>
        <input
          id={name}
          name={name}
          type="number"
          className={`${inputClassName} pl-8`}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
        />
      </div>
      {error && <p className="form-error">{error[0]}</p>}
    </div>
  );
}
