"use client";

import { useActionState, useState } from "react";
import {
  createPeriodAction,
  updatePeriodAction,
} from "../actions";
import type {
  PeriodView,
  CreatePeriodFormState,
  UpdatePeriodFormState,
} from "../schedules.schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GradeLevelOption {
  id: string;
  name: string;
  order: number;
}

interface PeriodFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: PeriodView;
  gradeLevels: GradeLevelOption[];
  defaultSchoolYearId: string;
  onSuccess: () => void;
}

export default function PeriodFormModal({
  open,
  onOpenChange,
  period,
  gradeLevels,
  defaultSchoolYearId,
  onSuccess,
}: PeriodFormModalProps) {
  const isEditing = !!period;

  // Form state
  const [name, setName] = useState(period?.name ?? "");
  const [periodNumber, setPeriodNumber] = useState(
    period?.periodNumber?.toString() ?? ""
  );
  const [startTime, setStartTime] = useState(period?.startTime ?? "07:30");
  const [endTime, setEndTime] = useState(period?.endTime ?? "08:30");
  const [isClassPeriod, setIsClassPeriod] = useState(
    period?.isClassPeriod ?? true
  );
  const [gradeLevelId, setGradeLevelId] = useState<string>(
    period?.gradeLevelId ?? ""
  );
  const schoolYearId = period?.schoolYearId ?? defaultSchoolYearId;

  const initialState: CreatePeriodFormState | UpdatePeriodFormState = {};

  const [state, action, pending] = useActionState(
    isEditing ? updatePeriodAction : createPeriodAction,
    initialState
  );

  useFormToast(state, {
    successMessage: isEditing
      ? "Period updated successfully"
      : "Period created successfully",
    onSuccess: () => {
      onSuccess();
      // Reset form for create
      if (!isEditing) {
        setName("");
        setPeriodNumber("");
        setStartTime("07:30");
        setEndTime("08:30");
        setIsClassPeriod(true);
        setGradeLevelId("");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Period" : "Create Period"}
          </DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {isEditing && <input type="hidden" name="id" value={period.id} />}
          <input type="hidden" name="schoolYearId" value={schoolYearId} />

          {/* Period Number */}
          <div className="space-y-2">
            <Label htmlFor="periodNumber">Period Number</Label>
            <Input
              id="periodNumber"
              name="periodNumber"
              type="number"
              min="1"
              value={periodNumber}
              onChange={(e) => setPeriodNumber(e.target.value)}
              placeholder="1"
              required
            />
            {state.errors?.periodNumber && (
              <p className="text-sm text-destructive">
                {state.errors.periodNumber[0]}
              </p>
            )}
          </div>

          {/* Period Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Period Name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Period 1"
              required
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              E.g., Period 1, Homeroom, Lunch Break
            </p>
            {state.errors?.name && (
              <p className="text-sm text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
              {state.errors?.startTime && (
                <p className="text-sm text-destructive">
                  {state.errors.startTime[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
              {state.errors?.endTime && (
                <p className="text-sm text-destructive">
                  {state.errors.endTime[0]}
                </p>
              )}
            </div>
          </div>

          {/* Is Class Period */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="isClassPeriod">Class Period</Label>
              <p className="text-xs text-muted-foreground">
                Uncheck for breaks, lunch, or non-instructional time
              </p>
            </div>
            <Switch
              id="isClassPeriod"
              name="isClassPeriod"
              checked={isClassPeriod}
              onCheckedChange={setIsClassPeriod}
              value="true"
            />
            {!isClassPeriod && (
              <input type="hidden" name="isClassPeriod" value="false" />
            )}
          </div>

          {/* Grade Level */}
          <div className="space-y-2">
            <Label htmlFor="gradeLevelId">Grade Level (Optional)</Label>
            <Select
              name="gradeLevelId"
              value={gradeLevelId}
              onValueChange={setGradeLevelId}
            >
              <SelectTrigger id="gradeLevelId">
                <SelectValue placeholder="All Grades (Universal)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Grades (Universal)</SelectItem>
                {gradeLevels.map((gl) => (
                  <SelectItem key={gl.id} value={gl.id}>
                    {gl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Each grade level can have its own unique bell schedule
            </p>
          </div>

          {/* General Error */}
          {state.message && !state.success && (
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
                  ? "Update Period"
                  : "Create Period"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
