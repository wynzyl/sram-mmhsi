"use client";

import { GraduationCap } from "lucide-react";
import { StepHeader } from "./wizard-utils";
import { editorialFieldClass } from "@/lib/utils/editorial-styles";
import { cn } from "@/lib/utils/cn";
import type { PlacementType } from "./PlacementPreviewCard";
import type { EnrollmentFormState } from "../enrollments.schema";

interface SchoolYear {
  id: string;
  label: string;
}

interface GradeLevel {
  id: string;
  name: string;
  order: number;
}

type PromotionHint = {
  lastGradeLevelId: string;
  lastGradeName: string;
  nextGradeLevelId: string;
  hasNextGradeLevel: boolean;
};

export interface WizardStepPlacementProps {
  currentSchoolYear: SchoolYear | null;
  gradeLevels: GradeLevel[];
  gradeLevelId: string;
  onGradeLevelChange: (id: string) => void;
  studentType: PlacementType;
  onStudentTypeChange: (type: PlacementType) => void;
  lockedToOldStudent: boolean;
  promotionHint?: PromotionHint;
  hasRegistrationContext: boolean;
  previousSchool: string;
  onPreviousSchoolChange: (value: string) => void;
  errors?: EnrollmentFormState["errors"];
}

/**
 * Step 2: Academic placement — school year (read-only), grade level, enrollment type.
 */
export default function WizardStepPlacement({
  currentSchoolYear,
  gradeLevels,
  gradeLevelId,
  onGradeLevelChange,
  studentType,
  onStudentTypeChange,
  lockedToOldStudent,
  promotionHint,
  hasRegistrationContext,
  previousSchool,
  onPreviousSchoolChange,
  errors,
}: WizardStepPlacementProps) {
  const promotionMessage = promotionHint
    ? promotionHint.hasNextGradeLevel
      ? `Prior enrollment: ${promotionHint.lastGradeName}. Default is the next level — change only when appropriate.`
      : `${promotionHint.lastGradeName} matches the highest grade in the catalog. Confirm with admin.`
    : hasRegistrationContext
    ? "Default grade matches the approved registration; change if enrollment differs."
    : null;

  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Step 02 / Placement"
        title="Confirm academic placement"
        description="Active school year is fixed. Set grade and enrollment type before continuing."
        icon={<GraduationCap className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            School Year <span className="text-destructive">*</span>
          </span>
          <div
            className={editorialFieldClass({
              invalid: Boolean(errors?.schoolYearId),
              className: "bg-muted",
            })}
            aria-live="polite"
          >
            {currentSchoolYear ? (
              <>
                <strong className="text-foreground">{currentSchoolYear.label}</strong>
                <span className="ml-2 text-xs text-muted-foreground">(active year only)</span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          {errors?.schoolYearId && (
            <p className="mt-1 text-sm text-destructive">{errors.schoolYearId[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="gradeLevelIdSelect"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Grade Level <span className="text-destructive">*</span>
          </label>
          <select
            id="gradeLevelIdSelect"
            value={gradeLevelId}
            onChange={(e) => onGradeLevelChange(e.target.value)}
            required
            className={editorialFieldClass({ invalid: Boolean(errors?.gradeLevelId) })}
          >
            <option value="">Select grade level</option>
            {gradeLevels.map((gl) => (
              <option key={gl.id} value={gl.id}>
                {gl.name}
              </option>
            ))}
          </select>
          {errors?.gradeLevelId && (
            <p className="mt-1 text-sm text-destructive">{errors.gradeLevelId[0]}</p>
          )}
          {promotionMessage && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{promotionMessage}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          Enrollment Type <span className="text-destructive">*</span>
        </span>

        {lockedToOldStudent ? (
          <div
            className={editorialFieldClass({
              invalid: Boolean(errors?.studentType),
              className: "bg-muted",
            })}
          >
            <strong className="text-foreground">Returning</strong>
            <span className="ml-2 text-xs text-muted-foreground">(prior enrollment on file — fixed)</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TypeRadioCard
              label="New"
              caption="First time at this school."
              checked={studentType === "new_student"}
              onChange={() => onStudentTypeChange("new_student")}
              suggested={!hasRegistrationContext && studentType === "new_student"}
            />
            <TypeRadioCard
              label="Transferee"
              caption="Coming from another school."
              checked={studentType === "transferee"}
              onChange={() => onStudentTypeChange("transferee")}
              suggested={hasRegistrationContext && studentType === "transferee"}
            />
          </div>
        )}
        {errors?.studentType && (
          <p className="mt-1 text-sm text-destructive">{errors.studentType[0]}</p>
        )}
      </div>

      {!lockedToOldStudent && studentType === "transferee" && (
        <div>
          <label
            htmlFor="previousSchoolInput"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Previous school <span className="text-destructive">*</span>
          </label>
          <input
            id="previousSchoolInput"
            value={previousSchool}
            onChange={(e) => onPreviousSchoolChange(e.target.value)}
            placeholder="Name of school last attended"
            autoComplete="organization"
            required
            className={editorialFieldClass({ invalid: Boolean(errors?.previousSchool) })}
          />
          {errors?.previousSchool && (
            <p className="mt-1 text-sm text-destructive">{errors.previousSchool[0]}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal component for enrollment type radio cards
// ─────────────────────────────────────────────────────────────────────────────

function TypeRadioCard({
  label,
  caption,
  checked,
  onChange,
  suggested,
}: {
  label: string;
  caption: string;
  checked: boolean;
  onChange: () => void;
  suggested: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={cn(
        "group flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary/15",
        checked
          ? "border-primary bg-primary/[0.04] shadow-sm"
          : "border-border bg-card hover:border-border hover:bg-muted"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className={cn(
            "font-display text-base font-bold",
            checked ? "text-primary" : "text-foreground"
          )}
        >
          {label}
        </span>
        {suggested && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-warning">
            Suggested
          </span>
        )}
      </div>
      <span className="text-xs leading-relaxed text-muted-foreground">{caption}</span>
    </button>
  );
}
