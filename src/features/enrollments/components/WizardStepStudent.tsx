"use client";

import { UserSearch } from "lucide-react";
import { StepHeader } from "./wizard-utils";
import { StudentPicker, type StudentPickerOption } from "@/features/enrollments";
import type { EnrollmentFormState } from "../enrollments.schema";

export interface WizardStepStudentProps {
  students: StudentPickerOption[];
  studentId: string;
  onStudentChange: (id: string) => void;
  errors?: EnrollmentFormState["errors"];
}

/**
 * Step 1: Student selection via searchable picker.
 */
export default function WizardStepStudent({
  students,
  studentId,
  onStudentChange,
  errors,
}: WizardStepStudentProps) {
  return (
    <div>
      <StepHeader
        eyebrow="Step 01 / Student"
        title="Pick the learner"
        description="Search by family name or student reference. Suggestions auto-resolve type from prior records."
        icon={<UserSearch className="h-5 w-5" />}
      />

      <div className="space-y-2">
        <label
          htmlFor="studentId"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Student <span className="text-red-600">*</span>
        </label>
        <StudentPicker
          students={students}
          value={studentId}
          onChange={onStudentChange}
          invalid={Boolean(errors?.studentId)}
          errorMessage={errors?.studentId?.[0]}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Only active students appear. To enroll a new arrival, register them first under{" "}
          <strong className="text-foreground">Registrations</strong>.
        </p>
      </div>
    </div>
  );
}
