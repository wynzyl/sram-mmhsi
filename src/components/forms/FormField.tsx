import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  error?: string | string[];
  required?: boolean;
  hint?: string;
}

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, error, required, hint, children, className, ...props }, ref) => {
    const errorText = Array.isArray(error) ? error[0] : error;

    return (
      <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
        <label className="text-sm font-medium text-[var(--color-text-2)]">
          {label}
          {required && <span className="ml-1 text-[var(--color-error)]">*</span>}
        </label>
        {children}
        {hint && !errorText && (
          <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}
        {errorText && (
          <p className="text-xs text-[var(--color-error)] font-medium">{errorText}</p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";
