"use client";

import { useState, useActionState } from "react";
import { requestEnrollmentCancellationAction } from "../enrollment-cancellation.actions";
import { CANCELLATION_REASONS, CANCELLATION_REASON_LABELS, isRemarksRequired, type CancellationReason } from "@/lib/constants/cancellation-reasons";
import { useFormToast } from "@/hooks/useFormToast";
import { TextAreaField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";
import { cn } from "@/lib/utils/cn";
import { AlertTriangle } from "lucide-react";

export interface RequestCancellationFormProps {
  enrollmentId: string;
  studentName: string;
  gradeLevelName: string;
}

/**
 * Form for requesting enrollment cancellation.
 * Used for enrolled enrollments that require admin approval.
 */
export default function RequestCancellationForm({
  enrollmentId,
  studentName,
  gradeLevelName,
}: RequestCancellationFormProps) {
  const [state, action, pending] = useActionState(requestEnrollmentCancellationAction, {});
  const [reasonType, setReasonType] = useState<CancellationReason | "">("");
  const [remarks, setRemarks] = useState("");

  useFormToast(state, {
    successMessage: "Cancellation request submitted. An administrator will review your request.",
  });

  const reasonOptions = CANCELLATION_REASONS.map((reason) => ({
    value: reason,
    label: CANCELLATION_REASON_LABELS[reason],
  }));

  const requiresRemarks = reasonType !== "" && isRemarksRequired(reasonType);

  if (state.success) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-4">
        <p className="text-sm text-success">
          Cancellation request submitted successfully. Request ID:{" "}
          <span className="font-mono text-xs">{state.requestId}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-warning/25 bg-warning/10 p-4">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-warning">
            Request Enrollment Cancellation
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This enrollment is currently active. Cancellation requires administrator approval.
          </p>
        </div>
      </div>

      <div className="mb-3 rounded-md bg-white/50 p-2 text-xs">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{studentName}</span>
          {" - "}
          <span>{gradeLevelName}</span>
        </p>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />

        <SelectField
          label="Reason for cancellation"
          name="reasonType"
          required
          value={reasonType}
          onChange={(value) => setReasonType(value as CancellationReason)}
          error={state.errors?.reasonType}
          options={reasonOptions}
          placeholder="Select a reason..."
        />

        <TextAreaField
          label={requiresRemarks ? "Details (required)" : "Additional remarks (optional)"}
          name="remarks"
          required={requiresRemarks}
          value={remarks}
          onChange={setRemarks}
          error={state.errors?.remarks}
          rows={3}
          placeholder={
            requiresRemarks
              ? "Please provide details for your cancellation reason (minimum 10 characters)..."
              : "Any additional information to support your request..."
          }
        />

        {state.errors?._form && (
          <p className="text-xs text-destructive">{state.errors._form.join(", ")}</p>
        )}

        {state.message && !state.success && (
          <p className="text-xs text-destructive">{state.message}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={pending || !reasonType}
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-warning px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all",
              "hover:bg-warning disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {pending ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
