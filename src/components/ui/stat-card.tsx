import {
  GraduationCap,
  TrendingUp,
  Wallet,
  BarChart3,
  Receipt,
  AlertTriangle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STAT_ICONS = {
  enrollment: GraduationCap,
  conversion: TrendingUp,
  collection: Wallet,
  rate: BarChart3,
  receivables: Receipt,
  overdue: AlertTriangle,
  users: Users,
} as const;

export type StatIconType = keyof typeof STAT_ICONS;

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  iconType: StatIconType;
  className?: string;
}

export function StatCard({
  label,
  value,
  subtext,
  iconType,
  className,
}: StatCardProps) {
  const Icon = STAT_ICONS[iconType];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md",
        "animate-fade-up",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {value}
          </p>
          {subtext && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {subtext}
            </p>
          )}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
