"use client";

import type { ScheduleConflict, ConflictType } from "../schedules.schema";
import { DAY_OF_WEEK_LABELS } from "../schedules.schema";
import { AlertTriangle, Users, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ConflictWarningProps {
  conflicts: ScheduleConflict[];
  className?: string;
}

const CONFLICT_ICONS: Record<ConflictType, React.ReactNode> = {
  section: <Users className="h-4 w-4" />,
  teacher: <User className="h-4 w-4" />,
  room: <MapPin className="h-4 w-4" />,
};

const CONFLICT_LABELS: Record<ConflictType, string> = {
  section: "Section Conflict",
  teacher: "Teacher Conflict",
  room: "Room Conflict",
};

/**
 * Displays schedule conflicts with details.
 * Shows conflict type, day/period, and description.
 */
export function ConflictWarning({ conflicts, className }: ConflictWarningProps) {
  if (conflicts.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/50 bg-destructive/10 p-4",
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <span className="font-semibold text-destructive">
          {conflicts.length} Conflict{conflicts.length !== 1 ? "s" : ""} Detected
        </span>
      </div>

      <ul className="space-y-2">
        {conflicts.map((conflict, index) => (
          <li
            key={`${conflict.type}-${conflict.periodId}-${index}`}
            className="flex items-start gap-2 text-sm"
          >
            <span className="text-destructive mt-0.5">
              {CONFLICT_ICONS[conflict.type]}
            </span>
            <div>
              <span className="font-medium text-foreground">
                {CONFLICT_LABELS[conflict.type]}
              </span>
              <span className="text-muted-foreground mx-1">—</span>
              <span className="text-muted-foreground">
                {DAY_OF_WEEK_LABELS[conflict.dayOfWeek]}, {conflict.periodName}
              </span>
              <p className="text-muted-foreground mt-0.5">
                {conflict.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Inline conflict badge for compact display.
 */
export function ConflictBadge({
  type,
  className,
}: {
  type: ConflictType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
        "bg-destructive/10 text-destructive border border-destructive/20",
        className
      )}
    >
      {CONFLICT_ICONS[type]}
      {CONFLICT_LABELS[type]}
    </span>
  );
}
