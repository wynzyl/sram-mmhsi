import { cn } from "@/lib/utils/cn";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Width constraint for the page content
   * - narrow: 64rem (1024px) - Best for forms
   * - standard: 80rem (1280px) - Best for tables (default)
   * - wide: 96rem (1536px) - Best for dashboards
   * - full: No max-width constraint - Best for directories
   */
  width?: "narrow" | "standard" | "wide" | "full";
}

const widthVariants = {
  narrow: "max-w-[var(--page-width-narrow)]",
  standard: "max-w-[var(--page-width-standard)]",
  wide: "max-w-[var(--page-width-wide)]",
  full: "",
};

/**
 * Standardized page container component
 * Provides consistent spacing and layout for page content
 */
export function PageContainer({
  children,
  className,
  width = "standard",
  ...props
}: PageContainerProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full space-y-[var(--space-section-gap)] p-[var(--space-page-padding)]",
        widthVariants[width],
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}
