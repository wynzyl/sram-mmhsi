import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center justify-center box-border h-6 min-h-6 rounded-md px-2.5 text-xs font-semibold leading-none border",
  {
    variants: {
      variant: {
        success:
          "bg-[var(--color-accent-100)] text-[var(--color-accent-700)] border-[var(--color-accent-200)]",
        danger:
          "bg-[var(--color-error-100)] text-[var(--color-error-700)] border-[var(--color-error-200)]",
        warning:
          "bg-[var(--color-warning-100)] text-[var(--color-warning-700)] border-[var(--color-warning-200)]",
        info:
          "bg-[var(--color-info-100)] text-[var(--color-info-700)] border-[var(--color-info-200)]",
        secondary:
          "bg-[var(--color-surface-2)] text-[var(--color-text-2)] border-[var(--color-border-2)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
