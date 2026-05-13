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
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 border border-primary",
        secondary:
          "bg-card text-foreground border border-border shadow-xs hover:bg-muted",
        ghost:
          "border border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        danger:
          "bg-destructive text-destructive-foreground border border-destructive shadow-sm hover:bg-destructive/90",
        "danger-outline":
          "border border-destructive bg-transparent text-destructive hover:bg-destructive/10",
        success:
          "bg-success text-success-foreground border border-success shadow-sm hover:bg-success/90",
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
