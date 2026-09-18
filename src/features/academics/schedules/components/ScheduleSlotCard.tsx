"use client";

import type { ScheduleSlotView } from "../schedules.schema";
import { cn } from "@/lib/utils/cn";
import { MapPin, User } from "lucide-react";

interface ScheduleSlotCardProps {
  slot: ScheduleSlotView;
  onClick?: () => void;
  className?: string;
}

/**
 * Card component displaying a single schedule slot.
 * Shows subject, teacher, and room information.
 */
export function ScheduleSlotCard({
  slot,
  onClick,
  className,
}: ScheduleSlotCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-2 rounded-md border border-border bg-card",
        "hover:bg-muted/50 hover:border-primary/30 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        className
      )}
    >
      {/* Subject */}
      <div className="font-medium text-sm text-foreground truncate">
        {slot.subjectCode ? (
          <span className="font-mono text-xs text-muted-foreground mr-1">
            {slot.subjectCode}
          </span>
        ) : null}
        {slot.subjectName}
      </div>

      {/* Teacher */}
      {slot.teacherName && (
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="truncate">{slot.teacherName}</span>
        </div>
      )}

      {/* Room */}
      {slot.roomCode && (
        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{slot.roomCode}</span>
        </div>
      )}
    </button>
  );
}

/**
 * Empty slot placeholder - shows when no class is scheduled.
 */
export function EmptySlotCard({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full h-full min-h-[60px] rounded-md border border-dashed border-border",
        "hover:bg-muted/30 hover:border-primary/30 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        "flex items-center justify-center",
        className
      )}
    >
      <span className="text-xs text-muted-foreground">—</span>
    </button>
  );
}
