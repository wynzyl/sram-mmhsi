import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DataCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

/**
 * Elevated card component with sophisticated borders and shadows.
 * Part of the Editorial Design System for SRAMS.
 */
export function DataCard({
  children,
  className,
  hoverable = false,
  onClick,
}: DataCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]",
        "shadow-sm transition-all duration-150",
        hoverable && "hover-elevate cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface DataCardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function DataCardHeader({ children, className }: DataCardHeaderProps) {
  return (
    <div className={cn("border-b border-[var(--color-border)] px-6 py-4", className)}>
      {children}
    </div>
  );
}

interface DataCardBodyProps {
  children: ReactNode;
  className?: string;
}

export function DataCardBody({ children, className }: DataCardBodyProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

interface DataCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function DataCardFooter({ children, className }: DataCardFooterProps) {
  return (
    <div
      className={cn(
        "border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-6 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}
