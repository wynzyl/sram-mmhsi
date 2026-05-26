import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface SectionHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  accent?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: {
    title: "text-xl font-semibold",
    subtitle: "text-sm",
  },
  md: {
    title: "text-2xl font-bold",
    subtitle: "text-base",
  },
  lg: {
    title: "text-4xl font-black tracking-tight",
    subtitle: "text-lg",
  },
};

/**
 * Large, bold section headers with optional accent rules.
 * Part of the Editorial Design System for SRAMS.
 */
export function SectionHeader({
  title,
  subtitle,
  actions,
  accent = false,
  size = "lg",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1
            className={cn(
              "font-display text-foreground",
              sizeClasses[size].title,
              accent && "relative inline-block"
            )}
          >
            {title}
            {accent && (
              <span
                className="absolute -bottom-2 left-0 h-1 w-16 bg-[var(--color-primary)] rounded-full"
                aria-hidden="true"
              />
            )}
          </h1>
          {subtitle && (
            <p
              className={cn(
                "mt-2 text-muted-foreground",
                sizeClasses[size].subtitle
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
