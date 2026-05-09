import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full px-3 py-2 border rounded-md text-sm transition-colors duration-150",
          "bg-[var(--color-surface)] text-[var(--color-text)]",
          "focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "placeholder:text-[var(--color-text-muted)]",
          error
            ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20"
            : "border-[var(--color-border-2)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
