import { cn } from "@/lib/utils/cn";

type StatusType = "pending" | "complete" | "to-follow" | "approved" | "declined" | "n/a";

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<
  StatusType,
  { color: string; bgColor: string; label: string }
> = {
  pending: {
    color: "text-accent-amber",
    bgColor: "bg-accent-amber/10",
    label: "Pending",
  },
  complete: {
    color: "text-accent-emerald",
    bgColor: "bg-accent-emerald/10",
    label: "Complete",
  },
  "to-follow": {
    color: "text-accent-slate",
    bgColor: "bg-accent-slate/10",
    label: "To Follow",
  },
  approved: {
    color: "text-accent-emerald",
    bgColor: "bg-accent-emerald/10",
    label: "Approved",
  },
  declined: {
    color: "text-destructive",
    bgColor: "bg-destructive-tint",
    label: "Declined",
  },
  "n/a": {
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: "N/A",
  },
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

/**
 * Animated status badge with subtle pulse effect.
 * Part of the Editorial Design System for SRAMS.
 */
export function StatusIndicator({
  status,
  label,
  pulse = false,
  size = "md",
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium font-mono",
        "transition-all duration-200",
        config.color,
        config.bgColor,
        sizeClasses[size],
        pulse && "animate-badge-pulse"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "pending" && "bg-accent-amber",
          status === "complete" && "bg-accent-emerald",
          status === "to-follow" && "bg-accent-slate",
          status === "approved" && "bg-accent-emerald",
          status === "declined" && "bg-destructive",
          status === "n/a" && "bg-border"
        )}
      />
      {displayLabel}
    </span>
  );
}
