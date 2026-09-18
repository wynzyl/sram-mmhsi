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
  PeriodGradeGroup,
} from "../schedules.schema";
import {
  PERIOD_GRADE_GROUPS,
  PERIOD_GRADE_GROUP_LABELS,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

/** Selection type for period grade assignment */
type GradeSelectionType = "all" | PeriodGradeGroup | "specific";

/**
 * Get the selection type from a period's gradeGroup and gradeLevelId.
 */
function getSelectionType(period?: PeriodView): GradeSelectionType {
  if (!period) return "all";
  if (period.gradeGroup) return period.gradeGroup;
  if (period.gradeLevelId) return "specific";
  return "all";
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

  // Grade selection: "all" | "casa" | "elementary" | "jhs" | "shs" | "specific"
  const [selectionType, setSelectionType] = useState<GradeSelectionType>(
    getSelectionType(period)
  );
  // Only used when selectionType is "specific"
  const [specificGradeLevelId, setSpecificGradeLevelId] = useState<string>(
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
        setSelectionType("all");
        setSpecificGradeLevelId("");
      }
    },
  });

  // Derive gradeGroup and gradeLevelId from selectionType
  const gradeGroup: PeriodGradeGroup | null =
    selectionType !== "all" && selectionType !== "specific"
      ? selectionType
      : null;
  const gradeLevelId: string | null =
    selectionType === "specific" && specificGradeLevelId
      ? specificGradeLevelId
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Period" : "Create Period"}
          </DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {isEditing && <input type="hidden" name="id" value={period.id} />}
          <input type="hidden" name="schoolYearId" value={schoolYearId} />
          {/* Hidden inputs for gradeGroup and gradeLevelId */}
          {gradeGroup && (
            <input type="hidden" name="gradeGroup" value={gradeGroup} />
          )}
          {gradeLevelId && (
            <input type="hidden" name="gradeLevelId" value={gradeLevelId} />
          )}

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

          {/* Grade Selection */}
          <div className="space-y-3">
            <Label>Applies To</Label>
            <RadioGroup
              value={selectionType}
              onValueChange={(value) => setSelectionType(value as GradeSelectionType)}
              className="space-y-2"
            >
              {/* All Grades (Universal) */}
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="grade-all" />
                <Label htmlFor="grade-all" className="flex-1 cursor-pointer">
                  <span className="font-medium">All Grades</span>
                  <span className="block text-xs text-muted-foreground">
                    Universal period for all grade levels
                  </span>
                </Label>
              </div>

              {/* Grade Groups */}
              {PERIOD_GRADE_GROUPS.map((group) => (
                <div
                  key={group}
                  className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                >
                  <RadioGroupItem value={group} id={`grade-${group}`} />
                  <Label htmlFor={`grade-${group}`} className="flex-1 cursor-pointer">
                    <span className="font-medium capitalize">{group}</span>
                    <span className="block text-xs text-muted-foreground">
                      {PERIOD_GRADE_GROUP_LABELS[group]}
                    </span>
                  </Label>
                </div>
              ))}

              {/* Specific Grade Level */}
              <div className="rounded-lg border p-3 hover:bg-muted/50">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="specific" id="grade-specific" />
                  <Label htmlFor="grade-specific" className="flex-1 cursor-pointer">
                    <span className="font-medium">Specific Grade</span>
                    <span className="block text-xs text-muted-foreground">
                      Select a single grade level
                    </span>
                  </Label>
                </div>
                {selectionType === "specific" && (
                  <div className="mt-3 ml-6">
                    <Select
                      value={specificGradeLevelId}
                      onValueChange={setSpecificGradeLevelId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade level" />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeLevels.map((gl) => (
                          <SelectItem key={gl.id} value={gl.id}>
                            {gl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </RadioGroup>

            {/* Validation errors */}
            {state.errors?.gradeGroup && (
              <p className="text-sm text-destructive">
                {state.errors.gradeGroup[0]}
              </p>
            )}
            {state.errors?.gradeLevelId && (
              <p className="text-sm text-destructive">
                {state.errors.gradeLevelId[0]}
              </p>
            )}
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
