import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  error?: string | string[];
  required?: boolean;
  hint?: string;
}

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, error, required, hint, children, className, ...props }, ref) => {
    const errorText = Array.isArray(error) ? error[0] : error;

    return (
      <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
        {children}
        {hint && !errorText && (
          <p className="text-helper">{hint}</p>
        )}
        {errorText && (
          <p className="text-xs text-destructive font-medium">{errorText}</p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";
