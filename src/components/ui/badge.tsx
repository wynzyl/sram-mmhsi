import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center justify-center box-border h-6 min-h-6 rounded-md px-2.5 text-xs font-semibold leading-none border",
  {
    variants: {
      variant: {
        success:
          "bg-success/15 text-success border-success/25",
        danger:
          "bg-destructive/15 text-destructive border-destructive/25",
        warning:
          "bg-warning/15 text-warning border-warning/25",
        info:
          "bg-info/15 text-info border-info/25",
        secondary:
          "bg-muted text-muted-foreground border-border",
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
