"use client";

import { useActionState, useState } from "react";
import {
  addFeeTemplateItemAction,
  removeFeeTemplateItemAction,
} from "../fee-templates.actions";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { SelectField } from "@/components/forms/SelectField";
import { CurrencyInputField } from "@/components/forms/CurrencyInputField";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { Button } from "@/components/ui/button";

type FeeItemType = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDiscount: boolean;
  displayOrder: number;
};

type FeeTemplateItem = {
  id: string;
  feeItemTypeId: string;
  defaultAmount: string;
  order: number;
  feeItemType: FeeItemType;
};

type FeeTemplateItemsManagerProps = {
  templateId: string;
  items: FeeTemplateItem[];
  availableFeeTypes: FeeItemType[];
};

export function FeeTemplateItemsManager({
  templateId,
  items,
  availableFeeTypes,
}: FeeTemplateItemsManagerProps) {
  const [addState, addAction, isAdding] = useActionState(
    addFeeTemplateItemAction,
    {}
  );
  const [feeItemTypeId, setFeeItemTypeId] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [order, setOrder] = useState("");

  // Filter out already added fee types
  const usedFeeTypeIds = new Set(items.map((item) => item.feeItemTypeId));
  const availableOptions = availableFeeTypes.filter(
    (ft) => !usedFeeTypeIds.has(ft.id)
  );

  return (
    <div className="space-y-6">
      {/* Add New Item Form */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Add Fee Item</h3>

        <form action={addAction} className="space-y-4">
          <input type="hidden" name="feeTemplateId" value={templateId} />

          <FormStateAlert state={addState} />

          <SelectField
            label="Fee Type"
            name="feeItemTypeId"
            required
            value={feeItemTypeId}
            onChange={setFeeItemTypeId}
            options={[
              { value: "", label: "Select fee type..." },
              ...availableOptions.map((ft) => ({
                value: ft.id,
                label: `${ft.name}${ft.isDiscount ? " (Discount)" : ""}`,
              })),
            ]}
            error={addState.errors?.feeItemTypeId}
          />

          <CurrencyInputField
            label="Default Amount"
            name="defaultAmount"
            required
            value={defaultAmount}
            onChange={(value) => setDefaultAmount(String(value))}
            error={addState.errors?.defaultAmount}
          />

          <div className="space-y-2">
            <label htmlFor="order" className="block text-sm font-medium">
              Display Order <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="number"
              id="order"
              name="order"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              min="0"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0"
            />
            <p className="text-sm text-gray-500">
              Lower numbers appear first. Leave blank to append to the end.
            </p>
            {addState.errors?.order && (
              <p className="text-sm text-red-600">{addState.errors.order[0]}</p>
            )}
          </div>

          <Button type="submit" disabled={isAdding || availableOptions.length === 0}>
            {isAdding ? "Adding..." : "Add Item"}
          </Button>

          {availableOptions.length === 0 && (
            <p className="text-sm text-amber-600">
              All available fee types have been added to this template.
            </p>
          )}
        </form>
      </div>

      {/* Current Items List */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Template Items</h3>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">
            No items yet. Add fee types above to build this template.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Order</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Fee Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">
                    Default Amount
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items
                  .sort((a, b) => a.order - b.order)
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{item.order}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {item.feeItemType.name}
                        {item.feeItemType.isDiscount && (
                          <span className="ml-2 text-xs text-green-600">(Discount)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-600">
                        {item.feeItemType.category}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(Number(item.defaultAmount))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <InlineConfirmButton
                          action={removeFeeTemplateItemAction}
                          confirmMessage={`Remove ${item.feeItemType.name} from this template?`}
                          hiddenFields={{ id: item.id }}
                          label="Remove"
                          loadingLabel="Removing..."
                          variant="danger"
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
