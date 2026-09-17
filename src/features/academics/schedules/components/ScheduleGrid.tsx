"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ScheduleGridRow,
  ScheduleSlotView,
  DayOfWeek,
  PeriodOption,
  RoomOption,
} from "../schedules.schema";
import {
  DAYS_OF_WEEK,
  DAY_OF_WEEK_LABELS,
  DAY_OF_WEEK_SHORT_LABELS,
} from "../schedules.schema";
import type { SubjectOfferingOption } from "../schedules.queries";
import { deleteScheduleSlotAction } from "../schedules.actions";
import { ScheduleSlotCard, EmptySlotCard } from "./ScheduleSlotCard";
import ScheduleSlotForm from "./ScheduleSlotForm";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ScheduleGridProps {
  rows: ScheduleGridRow[];
  subjectOfferings: SubjectOfferingOption[];
  periods: PeriodOption[];
  rooms: RoomOption[];
  canManage: boolean;
}

/**
 * Weekly schedule grid component.
 * Shows periods as rows and days as columns (Mon-Fri).
 */
export function ScheduleGrid({
  rows,
  subjectOfferings,
  periods,
  rooms,
  canManage,
}: ScheduleGridProps) {
  const router = useRouter();
  const [editingSlot, setEditingSlot] = useState<ScheduleSlotView | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    day: DayOfWeek;
    periodId: string;
  } | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<ScheduleSlotView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEmptySlotClick = (day: DayOfWeek, periodId: string) => {
    if (!canManage) return;
    setCreateDefaults({ day, periodId });
    setShowCreateForm(true);
  };

  const handleSlotClick = (slot: ScheduleSlotView) => {
    if (!canManage) return;
    setEditingSlot(slot);
  };

  const handleDelete = async () => {
    if (!deletingSlot) return;
    setIsDeleting(true);
    try {
      const result = await deleteScheduleSlotAction(deletingSlot.id);
      if (result.success) {
        toast.success(result.message);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(result.message);
      }
    } finally {
      setIsDeleting(false);
      setDeletingSlot(null);
    }
  };

  const handleSuccess = () => {
    setShowCreateForm(false);
    setEditingSlot(null);
    setCreateDefaults(null);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr>
              {/* Time/Period column */}
              <th className="sticky left-0 z-10 bg-muted border border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-24">
                Time
              </th>
              {/* Day columns */}
              {DAYS_OF_WEEK.map((day) => (
                <th
                  key={day}
                  className="bg-muted border border-border px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase"
                >
                  <span className="hidden sm:inline">{DAY_OF_WEEK_LABELS[day]}</span>
                  <span className="sm:hidden">{DAY_OF_WEEK_SHORT_LABELS[day]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.period.id}
                className={cn(
                  !row.period.isClassPeriod && "bg-muted/30"
                )}
              >
                {/* Period info */}
                <td className="sticky left-0 z-10 bg-card border border-border px-3 py-2 text-sm">
                  <div className="font-medium text-foreground">
                    {row.period.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {row.period.startTime} - {row.period.endTime}
                  </div>
                </td>

                {/* Day cells */}
                {DAYS_OF_WEEK.map((day) => {
                  const slot = row[day];
                  return (
                    <td
                      key={day}
                      className="border border-border p-1 align-top min-w-[140px]"
                    >
                      {!row.period.isClassPeriod ? (
                        // Break/non-class period
                        <div className="h-full min-h-[60px] flex items-center justify-center text-xs text-muted-foreground italic">
                          {row.period.name}
                        </div>
                      ) : slot ? (
                        // Has a scheduled slot
                        <div className="relative group">
                          <ScheduleSlotCard
                            slot={slot}
                            onClick={() => handleSlotClick(slot)}
                            className={!canManage ? "cursor-default" : undefined}
                          />
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingSlot(slot);
                              }}
                              title="Delete slot"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        // Empty slot
                        <EmptySlotCard
                          onClick={
                            canManage
                              ? () => handleEmptySlotClick(day, row.period.id)
                              : undefined
                          }
                          className={!canManage ? "cursor-default hover:bg-transparent hover:border-border" : undefined}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No periods message */}
      {rows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No periods configured for this school year.</p>
          <p className="text-sm mt-1">
            Add periods in the Period Management page first.
          </p>
        </div>
      )}

      {/* Create Form - key forces remount when cell changes */}
      {showCreateForm && createDefaults && (
        <ScheduleSlotForm
          key={`create-${createDefaults.day}-${createDefaults.periodId}`}
          open={showCreateForm}
          onOpenChange={(open) => {
            setShowCreateForm(open);
            if (!open) setCreateDefaults(null);
          }}
          defaultDay={createDefaults.day}
          defaultPeriodId={createDefaults.periodId}
          subjectOfferings={subjectOfferings}
          periods={periods}
          rooms={rooms}
          onSuccess={handleSuccess}
        />
      )}

      {/* Edit Form - key forces remount when slot changes */}
      {editingSlot && (
        <ScheduleSlotForm
          key={`edit-${editingSlot.id}`}
          open={true}
          onOpenChange={(open) => !open && setEditingSlot(null)}
          slot={editingSlot}
          subjectOfferings={subjectOfferings}
          periods={periods}
          rooms={rooms}
          onSuccess={handleSuccess}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingSlot}
        onOpenChange={(open) => !open && setDeletingSlot(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule Slot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{deletingSlot?.subjectName}</strong> from{" "}
              {deletingSlot ? DAY_OF_WEEK_LABELS[deletingSlot.dayOfWeek] : ""},{" "}
              {deletingSlot?.periodName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
