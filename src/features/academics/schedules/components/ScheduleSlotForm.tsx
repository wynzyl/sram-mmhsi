"use client";

import { useActionState, useState } from "react";
import {
  createScheduleSlotAction,
  updateScheduleSlotAction,
} from "../actions";
import type {
  ScheduleSlotView,
  CreateScheduleSlotFormState,
  UpdateScheduleSlotFormState,
  DayOfWeek,
  PeriodOption,
  RoomOption,
} from "../schedules.schema";
import { DAYS_OF_WEEK, DAY_OF_WEEK_LABELS } from "../schedules.schema";
import type { SubjectOfferingOption } from "../queries";
import { ConflictWarning } from "./ConflictWarning";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScheduleSlotFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot?: ScheduleSlotView;
  /** Pre-selected day (when clicking on empty cell) */
  defaultDay?: DayOfWeek;
  /** Pre-selected period (when clicking on empty cell) */
  defaultPeriodId?: string;
  /** Available subject offerings for this section */
  subjectOfferings: SubjectOfferingOption[];
  /** Available periods */
  periods: PeriodOption[];
  /** Available rooms */
  rooms: RoomOption[];
  onSuccess: () => void;
}

export default function ScheduleSlotForm({
  open,
  onOpenChange,
  slot,
  defaultDay,
  defaultPeriodId,
  subjectOfferings,
  periods,
  rooms,
  onSuccess,
}: ScheduleSlotFormProps) {
  const isEditing = !!slot;

  // Form state
  const [subjectOfferingId, setSubjectOfferingId] = useState(
    slot?.subjectOfferingId ?? ""
  );
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek | "">(
    slot?.dayOfWeek ?? defaultDay ?? ""
  );
  const [periodId, setPeriodId] = useState(
    slot?.periodId ?? defaultPeriodId ?? ""
  );
  const [roomId, setRoomId] = useState(slot?.roomId ?? "");

  const initialState: CreateScheduleSlotFormState | UpdateScheduleSlotFormState = {};

  const [state, action, pending] = useActionState(
    isEditing ? updateScheduleSlotAction : createScheduleSlotAction,
    initialState
  );

  useFormToast(state, {
    successMessage: isEditing
      ? "Schedule slot updated successfully"
      : "Schedule slot created successfully",
    onSuccess: () => {
      onSuccess();
    },
  });

  // Get selected subject offering for display
  const selectedOffering = subjectOfferings.find(
    (o) => o.value === subjectOfferingId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Schedule Slot" : "Add Schedule Slot"}
          </DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {isEditing && <input type="hidden" name="id" value={slot.id} />}

          {/* Subject Offering */}
          <div className="space-y-2">
            <Label htmlFor="subjectOfferingId">Subject</Label>
            <Select
              name="subjectOfferingId"
              value={subjectOfferingId}
              onValueChange={setSubjectOfferingId}
              required
            >
              <SelectTrigger id="subjectOfferingId">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjectOfferings.map((offering) => (
                  <SelectItem key={offering.value} value={offering.value}>
                    {offering.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOffering?.teacherName && (
              <p className="text-xs text-muted-foreground">
                Teacher: {selectedOffering.teacherName}
              </p>
            )}
            {state.errors?.subjectOfferingId && (
              <p className="text-sm text-destructive">
                {state.errors.subjectOfferingId[0]}
              </p>
            )}
          </div>

          {/* Day and Period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Day</Label>
              <Select
                name="dayOfWeek"
                value={dayOfWeek}
                onValueChange={(v) => setDayOfWeek(v as DayOfWeek)}
                required
              >
                <SelectTrigger id="dayOfWeek">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day}>
                      {DAY_OF_WEEK_LABELS[day]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.errors?.dayOfWeek && (
                <p className="text-sm text-destructive">
                  {state.errors.dayOfWeek[0]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodId">Period</Label>
              <Select
                name="periodId"
                value={periodId}
                onValueChange={setPeriodId}
                required
              >
                <SelectTrigger id="periodId">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.errors?.periodId && (
                <p className="text-sm text-destructive">
                  {state.errors.periodId[0]}
                </p>
              )}
            </div>
          </div>

          {/* Room (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="roomId">Room (Optional)</Label>
            <Select
              name="roomId"
              value={roomId}
              onValueChange={setRoomId}
            >
              <SelectTrigger id="roomId">
                <SelectValue placeholder="No room assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No room assigned</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.value} value={room.value}>
                    {room.label}
                    {room.capacity && (
                      <span className="text-muted-foreground ml-1">
                        (Cap: {room.capacity})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conflict Warning */}
          {state.conflicts && state.conflicts.length > 0 && (
            <ConflictWarning conflicts={state.conflicts} />
          )}

          {/* General Error */}
          {state.message && !state.success && !state.conflicts?.length && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                  ? "Update Slot"
                  : "Add Slot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
