"use client";

import { useActionState, useState } from "react";
import { createDiscountRequestAction } from "../discounts.actions";
import type {
  CreateDiscountRequestFormState,
  DiscountTypeView,
} from "../discounts.schema";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

interface DiscountRequestFormProps {
  studentId: string;
  enrollmentId: string;
  discountTypes: DiscountTypeView[];
  /**
   * Pre-select the discount type whose `code` matches this value. Used by the
   * post-reversal "Request replacement" deep link so the registrar lands on
   * the form with the right type already chosen.
   */
  initialDiscountTypeCode?: string;
  /** Optional default for the reason textbox (e.g., "Replacement for ..."). */
  initialRequestReason?: string;
  /** Called after successful submission */
  onSuccess?: () => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

export default function DiscountRequestForm({
  studentId,
  enrollmentId,
  discountTypes,
  initialDiscountTypeCode,
  initialRequestReason,
  onSuccess,
  onCancel,
}: DiscountRequestFormProps) {
  const initialType = initialDiscountTypeCode
    ? discountTypes.find(
        (t) => t.isActive && t.code === initialDiscountTypeCode
      )
    : undefined;
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    initialType?.id ?? ""
  );
  const [requestReason, setRequestReason] = useState<string>(
    initialRequestReason ?? ""
  );

  const initialState: CreateDiscountRequestFormState = {};
  const [state, action, pending] = useActionState(
    createDiscountRequestAction,
    initialState
  );

  useFormToast(state, {
    successMessage: "Discount request submitted successfully",
    onSuccess: () => {
      setSelectedTypeId("");
      setRequestReason("");
      onSuccess?.();
    },
  });

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
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
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

      {/* Discount Type Selection */}
      <div className="space-y-2">
        <label
          htmlFor="discountTypeId"
          className="text-sm font-medium text-foreground"
        >
          Discount Type
        </label>
        <select
          id="discountTypeId"
          name="discountTypeId"
          value={selectedTypeId}
          onChange={(e) => setSelectedTypeId(e.target.value)}
          required
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
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
          <p className="text-sm text-destructive">
            {state.errors.discountTypeId[0]}
          </p>
        )}
      </div>

      {/* Selected Type Details */}
      {selectedType && (
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Default Value:</span>
            <span className="font-medium">{formatValue(selectedType)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Applies To:</span>
            <span>
              {selectedType.baseType === "tuition_only"
                ? "Tuition Fees Only"
                : "Full Assessment Total"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stackable:</span>
            <span>{selectedType.isStackable ? "Yes" : "No"}</span>
          </div>
          {selectedType.requiresDocumentation && (
            <div className="text-xs text-amber-600 mt-2">
              Note: This discount requires supporting documentation.
            </div>
          )}
          {selectedType.description && (
            <div className="text-xs text-muted-foreground mt-2">
              {selectedType.description}
            </div>
          )}
        </div>
      )}

      {/* Request Reason */}
      <div className="space-y-2">
        <label
          htmlFor="requestReason"
          className="text-sm font-medium text-foreground"
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
        <p className="text-xs text-muted-foreground">
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
