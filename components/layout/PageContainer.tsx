import { cn } from "@/lib/utils/cn";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Standardized page container component
 * Provides consistent spacing and layout for page content
 */
export function PageContainer({
  children,
  className,
  ...props
}: PageContainerProps) {
  return (
    <main className={cn("space-y-6 p-4 md:p-6", className)} {...props}>
      {children}
    </main>
  );
}
