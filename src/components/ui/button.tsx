/**
 * Shadcn UI Button Component
 *
 * A flexible button component using class-variance-authority for variant management.
 *
 * @example
 * // Basic usage
 * <Button variant="primary" size="md">Submit</Button>
 *
 * @example
 * // With loading state
 * <Button variant="primary" loading={isPending}>
 *   Save changes
 * </Button>
 *
 * @example
 * // As a Link (using buttonVariants)
 * <Link href="/..." className={buttonVariants({ variant: "secondary", size: "sm" })}>
 *   Go to page
 * </Link>
 */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-2)]",
  {
    variants: {
      variant: {
        primary:
          "border border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-700)] hover:shadow-[var(--shadow)] focus-visible:ring-[var(--color-primary)]",
        secondary:
          "border border-[var(--color-border-2)] bg-[var(--color-surface-elevated)] text-[var(--color-text)] hover:bg-[var(--color-surface-3)] focus-visible:ring-[var(--color-border-2)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]",
        danger:
          "bg-[var(--color-error)] text-white border border-[var(--color-error)] hover:bg-red-700 focus-visible:ring-[var(--color-error)]",
        "danger-outline":
          "border border-red-500 bg-transparent text-red-600 hover:bg-red-50 focus-visible:ring-red-500/60 dark:text-red-400 dark:hover:bg-red-950/30",
        success:
          "border border-green-600 bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600/60",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

// Exported for cases where we need link-like buttons (e.g. Next `Link`)
// without extending the Button API (no `asChild` support in this project).
export { buttonVariants };

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
