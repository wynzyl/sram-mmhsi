"use client";

import { useActionState, useState, useEffect } from "react";
import { addFeeTemplateItemAction } from "../fee-templates.actions";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
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

  useEffect(() => {
    if (state.success) {
      onAdded();
    }
  }, [state.success, onAdded]);

  if (state.success) {
    return (
      <div className="fin-callout fin-callout-success">
        <div className="fin-callout-icon" aria-hidden>✓</div>
        <div>
          <p className="fin-callout-title">Fee item added!</p>
          <p className="fin-callout-body">The item has been added to this template.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="fin-form-stack">
      <input type="hidden" name="feeTemplateId" value={templateId} />

      <FormStateAlert state={state} />

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
          <span style={{ color: "var(--color-ops-muted)", fontWeight: 400 }}>
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
        <p className="fin-field-hint">Lower numbers appear first. Leave blank to append.</p>
        {state.errors?.order && (
          <p className="form-error">{state.errors.order[0]}</p>
        )}
      </div>

      <div className="fin-form-actions fin-form-actions-border">
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
