"use client";

import type { ScheduleSlotView, DayOfWeek } from "../schedules.schema";
import { DAY_OF_WEEK_LABELS } from "../schedules.schema";
import { cn } from "@/lib/utils/cn";
import { Clock, MapPin, User, BookOpen } from "lucide-react";

interface DayScheduleListProps {
  /** Slots for the day, sorted by period number */
  slots: ScheduleSlotView[];
  /** Day of week being displayed */
  dayOfWeek: DayOfWeek;
  /** Whether to show section name (for teacher view) */
  showSection?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  className?: string;
}

/**
 * Vertical list of schedule slots for a single day.
 * Used for "today's schedule" views and mobile-friendly display.
 */
export function DayScheduleList({
  slots,
  dayOfWeek,
  showSection = false,
  emptyMessage = "No classes scheduled",
  className,
}: DayScheduleListProps) {
  if (slots.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Day header */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {DAY_OF_WEEK_LABELS[dayOfWeek]}
      </h3>

      {/* Slot list */}
      <ul className="space-y-2">
        {slots.map((slot) => (
          <DayScheduleItem
            key={slot.id}
            slot={slot}
            showSection={showSection}
          />
        ))}
      </ul>
    </div>
  );
}

interface DayScheduleItemProps {
  slot: ScheduleSlotView;
  showSection?: boolean;
}

function DayScheduleItem({ slot, showSection }: DayScheduleItemProps) {
  return (
    <li className="flex gap-4 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
      {/* Time column */}
      <div className="flex-shrink-0 w-20 text-center">
        <div className="text-sm font-mono font-medium text-foreground">
          {slot.startTime}
        </div>
        <div className="text-xs text-muted-foreground">
          to {slot.endTime}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-border" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Subject */}
        <div className="font-medium text-foreground">
          {slot.subjectCode && (
            <span className="font-mono text-xs text-muted-foreground mr-1">
              {slot.subjectCode}
            </span>
          )}
          {slot.subjectName}
        </div>

        {/* Period name */}
        <div className="text-xs text-muted-foreground mt-0.5">
          {slot.periodName}
        </div>

        {/* Details row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          {/* Section (for teacher view) */}
          {showSection && slot.sectionName && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {slot.sectionName}
            </span>
          )}

          {/* Teacher (for student view) */}
          {!showSection && slot.teacherName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {slot.teacherName}
            </span>
          )}

          {/* Room */}
          {slot.roomCode && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {slot.roomCode}
              {slot.roomName && slot.roomName !== slot.roomCode && (
                <span className="text-muted-foreground/70">
                  ({slot.roomName})
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Compact version of day schedule for dashboard widgets.
 */
export function DayScheduleCompact({
  slots,
  maxItems = 5,
  className,
}: {
  slots: ScheduleSlotView[];
  maxItems?: number;
  className?: string;
}) {
  const displaySlots = slots.slice(0, maxItems);
  const remaining = slots.length - maxItems;

  if (slots.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground py-4 text-center", className)}>
        No classes today
      </div>
    );
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {displaySlots.map((slot) => (
        <li
          key={slot.id}
          className="flex items-center gap-2 text-sm"
        >
          <span className="font-mono text-xs text-muted-foreground w-12">
            {slot.startTime}
          </span>
          <span className="font-medium truncate flex-1">
            {slot.subjectName}
          </span>
          {slot.roomCode && (
            <span className="text-xs text-muted-foreground">
              {slot.roomCode}
            </span>
          )}
        </li>
      ))}
      {remaining > 0 && (
        <li className="text-xs text-muted-foreground text-center pt-1">
          +{remaining} more class{remaining !== 1 ? "es" : ""}
        </li>
      )}
    </ul>
  );
}
