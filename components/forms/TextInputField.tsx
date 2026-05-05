import type { ChangeEvent } from "react";

export type TextInputFieldProps = {
  /** Field label (displayed above input) */
  label: string;
  /** HTML name attribute (matches Zod schema key) */
  name: string;
  /** Input type */
  type?: "text" | "email" | "tel" | "date" | "number" | "password";
  /** Whether field is required (shows asterisk) */
  required?: boolean;
  /** Current input value (controlled) */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Field-level validation errors */
  error?: string[];
  /** HTML autocomplete attribute */
  autoComplete?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disable input */
  disabled?: boolean;
  /** Additional CSS classes for input */
  className?: string;
};

/**
 * Reusable controlled text input field with error display.
 * Replaces 40+ manual `<div className="form-group">` patterns across the codebase.
 *
 * @example
 * ```tsx
 * const [firstName, setFirstName] = useState("");
 *
 * <TextInputField
 *   label="First Name"
 *   name="firstName"
 *   type="text"
 *   required
 *   value={firstName}
 *   onChange={setFirstName}
 *   error={state.errors?.firstName}
 *   autoComplete="given-name"
 * />
 * ```
 */
export function TextInputField({
  label,
  name,
  type = "text",
  required = false,
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
  disabled = false,
  className,
}: TextInputFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const inputClassName = `form-control ${error ? "form-control-error" : ""} ${className ?? ""}`.trim();

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className={inputClassName}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={value}
        onChange={handleChange}
      />
      {error && <p className="form-error">{error[0]}</p>}
    </div>
  );
}

/**
 * Textarea variant for multi-line text input.
 *
 * @example
 * ```tsx
 * <TextAreaField
 *   label="Notes"
 *   name="notes"
 *   value={notes}
 *   onChange={setNotes}
 *   error={state.errors?.notes}
 *   rows={4}
 * />
 * ```
 */
export function TextAreaField({
  label,
  name,
  required = false,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  rows = 3,
  className,
}: Omit<TextInputFieldProps, "type" | "autoComplete"> & { rows?: number }) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const textareaClassName = `form-control ${error ? "form-control-error" : ""} ${className ?? ""}`.trim();

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        className={textareaClassName}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        value={value}
        onChange={handleChange}
      />
      {error && <p className="form-error">{error[0]}</p>}
    </div>
  );
}
