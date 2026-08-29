import { Calculator, CreditCard, GraduationCap, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// ─── Types ─────────────────────────────────────────────────────────────────

type EmptyStateIcon = "assessments" | "payments" | "grades" | "documents";

interface EmptyStateProps {
  /** Icon type to display */
  icon: EmptyStateIcon;
  /** Primary heading text */
  title: string;
  /** Supporting description text */
  description: string;
  /** Optional action element (e.g., a button or link) */
  action?: ReactNode;
  /** Additional className for the container */
  className?: string;
}

// ─── Icon Mapping ──────────────────────────────────────────────────────────

const ICON_MAP: Record<EmptyStateIcon, typeof Calculator> = {
  assessments: Calculator,
  payments: CreditCard,
  grades: GraduationCap,
  documents: FileText,
};

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Reusable empty state component for portal pages.
 * Displays an icon, title, description, and optional action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = ICON_MAP[icon];

  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border shadow-sm p-12 text-center",
        className
      )}
    >
      <Icon
        className="mx-auto h-12 w-12 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h3 className="mt-2 text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
