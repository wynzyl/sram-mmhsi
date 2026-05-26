"use client";

import { useActionState, useState } from "react";
import { addFeeTemplateItemAction } from "../fee-templates.actions";
import { useFormToast } from "@/hooks/useFormToast";
import { SelectField } from "@/components/forms/SelectField";
import { CurrencyInputField } from "@/components/forms/CurrencyInputField";
import { Button } from "@/components/ui/button";

type FeeItemOption = {
  id: string;
  name: string;
  isDiscount: boolean;
};

type AddFeeItemFormProps = {
  templateId: string;
  availableOptions: FeeItemOption[];
  onCancel: () => void;
  onAdded: () => void;
};

export function AddFeeItemForm({
  templateId,
  availableOptions,
  onCancel,
  onAdded,
}: AddFeeItemFormProps) {
  const [state, action, isAdding] = useActionState(addFeeTemplateItemAction, {});
  const [feeItemTypeId, setFeeItemTypeId] = useState("");
  const [defaultAmount, setDefaultAmount] = useState<number | string>("");
  const [order, setOrder] = useState("");

  useFormToast(state, {
    successMessage: "Fee item added successfully",
    onSuccess: onAdded,
  });

  if (state.success) {
    return null;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="feeTemplateId" value={templateId} />

      <SelectField
        label="Fee Type"
        name="feeItemTypeId"
        required
        value={feeItemTypeId}
        onChange={setFeeItemTypeId}
        options={[
          { value: "", label: "Select fee type…" },
          ...availableOptions.map((ft) => ({
            value: ft.id,
            label: `${ft.name}${ft.isDiscount ? " (Discount)" : ""}`,
          })),
        ]}
        error={state.errors?.feeItemTypeId}
      />

      <CurrencyInputField
        label="Default Amount"
        name="defaultAmount"
        required
        value={defaultAmount}
        onChange={(v) => setDefaultAmount(v)}
        error={state.errors?.defaultAmount}
        min={0}
      />

      <div className="form-group">
        <label htmlFor="add-item-order" className="form-label">
          Display Order{" "}
          <span className="text-gray-400 dark:text-gray-500 font-normal">
            (optional)
          </span>
        </label>
        <input
          type="number"
          id="add-item-order"
          name="order"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          min="0"
          className="form-control"
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first. Leave blank to append.</p>
        {state.errors?.order && (
          <p className="form-error">{state.errors.order[0]}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-border">
        <Button type="submit" disabled={isAdding || availableOptions.length === 0}>
          {isAdding ? "Adding…" : "Add Item"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
