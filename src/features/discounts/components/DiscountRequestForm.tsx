"use client";

import { useActionState, useState } from "react";
import { createDiscountRequestAction } from "../discounts.actions";
import type {
  CreateDiscountRequestFormState,
  DiscountTypeView,
} from "../discounts.schema";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

interface DiscountRequestFormProps {
  studentId: string;
  enrollmentId: string;
  discountTypes: DiscountTypeView[];
  /** Called after successful submission */
  onSuccess?: () => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

export default function DiscountRequestForm({
  studentId,
  enrollmentId,
  discountTypes,
  onSuccess,
  onCancel,
}: DiscountRequestFormProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [requestReason, setRequestReason] = useState<string>("");

  const initialState: CreateDiscountRequestFormState = {};
  const [state, action, pending] = useActionState(
    async (
      prevState: CreateDiscountRequestFormState,
      formData: FormData
    ): Promise<CreateDiscountRequestFormState> => {
      const result = await createDiscountRequestAction(prevState, formData);
      if (result.success && onSuccess) {
        // Reset form and call success callback
        setSelectedTypeId("");
        setRequestReason("");
        onSuccess();
      }
      return result;
    },
    initialState
  );

  const selectedType = discountTypes.find((t) => t.id === selectedTypeId);

  const formatValue = (type: DiscountTypeView) => {
    if (type.calculationType === "percentage") {
      return `${Number(type.defaultValue)}%`;
    }
    return (
      <CurrencyDisplay
        amount={Number(type.defaultValue)}
        className="inline-flex"
      />
    );
  };

  const activeTypes = discountTypes.filter((t) => t.isActive);

  if (activeTypes.length === 0) {
    return (
      <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
        <p className="text-sm text-[var(--color-text-muted)]">
          No discount types are currently available. Please contact finance to
          set up discount types.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />

      <FormStateAlert state={state} />

      {/* Discount Type Selection */}
      <div className="space-y-2">
        <label
          htmlFor="discountTypeId"
          className="text-sm font-medium text-[var(--color-text)]"
        >
          Discount Type
        </label>
        <select
          id="discountTypeId"
          name="discountTypeId"
          value={selectedTypeId}
          onChange={(e) => setSelectedTypeId(e.target.value)}
          required
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] text-[var(--color-text)] text-sm"
        >
          <option value="">Select a discount type...</option>
          {activeTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} ({type.calculationType === "percentage" ? "%" : "Fixed"} -{" "}
              {type.baseType === "tuition_only" ? "Tuition Only" : "Full"})
            </option>
          ))}
        </select>
        {state.errors?.discountTypeId && (
          <p className="text-sm text-[var(--color-danger)]">
            {state.errors.discountTypeId[0]}
          </p>
        )}
      </div>

      {/* Selected Type Details */}
      {selectedType && (
        <div className="p-3 bg-[var(--color-surface-2)] rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-muted)]">Default Value:</span>
            <span className="font-medium">{formatValue(selectedType)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-muted)]">Applies To:</span>
            <span>
              {selectedType.baseType === "tuition_only"
                ? "Tuition Fees Only"
                : "Full Assessment Total"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-muted)]">Stackable:</span>
            <span>{selectedType.isStackable ? "Yes" : "No"}</span>
          </div>
          {selectedType.requiresDocumentation && (
            <div className="text-xs text-[var(--color-warning)] mt-2">
              Note: This discount requires supporting documentation.
            </div>
          )}
          {selectedType.description && (
            <div className="text-xs text-[var(--color-text-muted)] mt-2">
              {selectedType.description}
            </div>
          )}
        </div>
      )}

      {/* Request Reason */}
      <div className="space-y-2">
        <label
          htmlFor="requestReason"
          className="text-sm font-medium text-[var(--color-text)]"
        >
          Reason (Optional)
        </label>
        <Input
          id="requestReason"
          name="requestReason"
          value={requestReason}
          onChange={(e) => setRequestReason(e.target.value)}
          placeholder="Why does this student qualify for this discount?"
          maxLength={500}
        />
        <p className="text-xs text-[var(--color-text-muted)]">
          Provide any relevant details for the finance reviewer.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={!selectedTypeId}
        >
          Submit Request
        </Button>
      </div>
    </form>
  );
}
