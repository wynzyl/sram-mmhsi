import type { ChangeEvent } from "react";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectFieldProps = {
  /** Field label (displayed above select) */
  label: string;
  /** HTML name attribute (matches Zod schema key) */
  name: string;
  /** Select options */
  options: SelectOption[];
  /** Whether field is required (shows asterisk) */
  required?: boolean;
  /** Current selected value (controlled) */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Field-level validation errors */
  error?: string[];
  /** Placeholder option text (value will be empty string) */
  placeholder?: string;
  /** Disable select */
  disabled?: boolean;
  /** Additional CSS classes for select */
  className?: string;
};

/**
 * Reusable controlled select dropdown with error display.
 * Standardizes select field patterns across the codebase.
 *
 * @example
 * ```tsx
 * const [gradeLevel, setGradeLevel] = useState("");
 *
 * <SelectField
 *   label="Grade Level"
 *   name="gradeLevelId"
 *   options={gradeLevels.map(g => ({ value: g.id, label: g.name }))}
 *   required
 *   value={gradeLevel}
 *   onChange={setGradeLevel}
 *   error={state.errors?.gradeLevelId}
 *   placeholder="Select grade level"
 * />
 * ```
 */
export function SelectField({
  label,
  name,
  options,
  required = false,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  className,
}: SelectFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const selectClassName = `form-control ${error ? "form-control-error" : ""} ${className ?? ""}`.trim();

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <select
        id={name}
        name={name}
        className={selectClassName}
        required={required}
        disabled={disabled}
        value={value}
        onChange={handleChange}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="form-error">{error[0]}</p>}
    </div>
  );
}

/**
 * Select field variant with option groups.
 *
 * @example
 * ```tsx
 * const groupedOptions = [
 *   {
 *     label: "Elementary",
 *     options: [
 *       { value: "1", label: "Grade 1" },
 *       { value: "2", label: "Grade 2" },
 *     ]
 *   },
 *   {
 *     label: "High School",
 *     options: [
 *       { value: "7", label: "Grade 7" },
 *       { value: "8", label: "Grade 8" },
 *     ]
 *   }
 * ];
 *
 * <SelectFieldGrouped
 *   label="Grade Level"
 *   name="gradeLevelId"
 *   optionGroups={groupedOptions}
 *   value={gradeLevel}
 *   onChange={setGradeLevel}
 * />
 * ```
 */
export function SelectFieldGrouped({
  label,
  name,
  optionGroups,
  required = false,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  className,
}: Omit<SelectFieldProps, "options"> & {
  optionGroups: Array<{ label: string; options: SelectOption[] }>;
}) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const selectClassName = `form-control ${error ? "form-control-error" : ""} ${className ?? ""}`.trim();

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <select
        id={name}
        name={name}
        className={selectClassName}
        required={required}
        disabled={disabled}
        value={value}
        onChange={handleChange}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {optionGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {error && <p className="form-error">{error[0]}</p>}
    </div>
  );
}
