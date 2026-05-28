"use client";

import { useState, useActionState } from "react";
import { directCancelEnrollmentAction } from "../enrollment-cancellation.actions";
import { CANCELLATION_REASONS, CANCELLATION_REASON_LABELS, isRemarksRequired, type CancellationReason } from "@/lib/constants/cancellation-reasons";
import { useFormToast } from "@/hooks/useFormToast";
import { TextAreaField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { cn } from "@/lib/utils/cn";
import { X } from "lucide-react";

export interface DirectCancelFormProps {
  enrollmentId: string;
  status: "pending" | "assessed";
  assessmentTotalPaid?: number | null;
  /**
   * Callback when user dismisses the form
   */
  onCancel?: () => void;
}

/**
 * Form for directly cancelling a pending or assessed enrollment.
 * Does not require admin approval - applies refund policy if payments exist.
 */
export default function DirectCancelForm({
  enrollmentId,
  status,
  assessmentTotalPaid,
  onCancel,
}: DirectCancelFormProps) {
  const [state, action, pending] = useActionState(directCancelEnrollmentAction, {});
  const [reasonType, setReasonType] = useState<CancellationReason | "">("");
  const [remarks, setRemarks] = useState("");

  useFormToast(state, {
    successMessage: "Enrollment cancelled successfully.",
  });

  const reasonOptions = CANCELLATION_REASONS.map((reason) => ({
    value: reason,
    label: CANCELLATION_REASON_LABELS[reason],
  }));

  const requiresRemarks = reasonType !== "" && isRemarksRequired(reasonType);
  const hasPaidAmount = (assessmentTotalPaid ?? 0) > 0.01;

  if (state.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
        <p className="text-sm font-medium text-green-700">Enrollment cancelled</p>
        {state.refundDetails && (
          <div className="mt-2 text-xs text-green-600">
            {state.refundDetails.isEligibleForRefund ? (
              <p>
                Refunded: <CurrencyDisplay amount={state.refundDetails.refundableAmount} />
                {state.refundDetails.forfeitedAmount > 0 && (
                  <> | Non-refundable (kept): <CurrencyDisplay amount={state.refundDetails.forfeitedAmount} /></>
                )}
              </p>
            ) : (
              <p>
                All payments forfeited (past cutoff date): <CurrencyDisplay amount={state.refundDetails.forfeitedAmount} />
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-100 bg-red-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-red-700">
          Cancel Enrollment
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {hasPaidAmount && (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
          <p className="font-medium">
            This enrollment has <CurrencyDisplay amount={assessmentTotalPaid!} /> in payments.
          </p>
          <p className="mt-1 text-amber-700">
            Refund policy will be applied based on the system cutoff date configuration.
            Refundable items may be reversed within the cutoff period.
          </p>
        </div>
      )}

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
          rows={2}
          placeholder={
            requiresRemarks
              ? "Please provide details (minimum 10 characters)..."
              : "Reason for cancellation..."
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
              "inline-flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all",
              "hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {pending ? "Cancelling..." : "Confirm Cancellation"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
