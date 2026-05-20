"use client";

import { useActionState, useState, useEffect } from "react";
import {
  createDiscountTypeAction,
  updateDiscountTypeAction,
} from "../discounts.actions";
import type {
  CreateDiscountTypeFormState,
  UpdateDiscountTypeFormState,
  DiscountTypeView,
} from "../discounts.schema";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DiscountTypeFormModalProps {
  discountType?: DiscountTypeView;
  onClose: () => void;
}

export default function DiscountTypeFormModal({
  discountType,
  onClose,
}: DiscountTypeFormModalProps) {
  const isEditing = !!discountType;

  // Form state
  const [code, setCode] = useState(discountType?.code ?? "");
  const [name, setName] = useState(discountType?.name ?? "");
  const [description, setDescription] = useState(discountType?.description ?? "");
  const [calculationType, setCalculationType] = useState<
    "fixed_amount" | "percentage"
  >(discountType?.calculationType ?? "percentage");
  const [baseType, setBaseType] = useState<"tuition_only" | "full_assessment">(
    discountType?.baseType ?? "tuition_only"
  );
  const [defaultValue, setDefaultValue] = useState(
    discountType?.defaultValue ?? ""
  );
  const [isActive, setIsActive] = useState(discountType?.isActive ?? true);
  const [requiresDocumentation, setRequiresDocumentation] = useState(
    discountType?.requiresDocumentation ?? true
  );
  const [isStackable, setIsStackable] = useState(
    discountType?.isStackable ?? true
  );
  const [displayOrder, setDisplayOrder] = useState(
    discountType?.displayOrder ?? 0
  );

  const initialState: CreateDiscountTypeFormState | UpdateDiscountTypeFormState =
    {};

  const [state, action, pending] = useActionState(
    async (
      prevState: CreateDiscountTypeFormState | UpdateDiscountTypeFormState,
      formData: FormData
    ): Promise<CreateDiscountTypeFormState | UpdateDiscountTypeFormState> => {
      const result = isEditing
        ? await updateDiscountTypeAction(
            prevState as UpdateDiscountTypeFormState,
            formData
          )
        : await createDiscountTypeAction(
            prevState as CreateDiscountTypeFormState,
            formData
          );

      if (result.success) {
        onClose();
      }
      return result;
    },
    initialState
  );

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-surface)] rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {isEditing ? "Edit Discount Type" : "Create Discount Type"}
        </h2>

        <form action={action} className="space-y-4">
          {isEditing && (
            <input type="hidden" name="id" value={discountType.id} />
          )}

          <FormStateAlert state={state} />

          {/* Code */}
          <div className="space-y-2">
            <label
              htmlFor="code"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Code
            </label>
            <Input
              id="code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ESC_20, SIBLING_10"
              required
              maxLength={50}
              className="font-mono"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              Uppercase letters, numbers, and underscores only.
            </p>
            {(state.errors as CreateDiscountTypeFormState["errors"])?.code && (
              <p className="text-sm text-[var(--color-danger)]">
                {(state.errors as CreateDiscountTypeFormState["errors"])!.code![0]}
              </p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Display Name
            </label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ESC 20% Government Subsidy"
              required
              maxLength={100}
            />
            {(state.errors as CreateDiscountTypeFormState["errors"])?.name && (
              <p className="text-sm text-[var(--color-danger)]">
                {(state.errors as CreateDiscountTypeFormState["errors"])!.name![0]}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="description"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Description (Optional)
            </label>
            <Input
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about this discount"
              maxLength={500}
            />
          </div>

          {/* Calculation Type & Base Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text)]">
                Calculation Type
              </label>
              <select
                name="calculationType"
                value={calculationType}
                onChange={(e) =>
                  setCalculationType(e.target.value as "fixed_amount" | "percentage")
                }
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] text-[var(--color-text)] text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (PHP)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text)]">
                Applies To
              </label>
              <select
                name="baseType"
                value={baseType}
                onChange={(e) =>
                  setBaseType(e.target.value as "tuition_only" | "full_assessment")
                }
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] text-[var(--color-text)] text-sm"
              >
                <option value="tuition_only">Tuition Only</option>
                <option value="full_assessment">Full Assessment</option>
              </select>
            </div>
          </div>

          {/* Default Value */}
          <div className="space-y-2">
            <label
              htmlFor="defaultValue"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Default Value{" "}
              {calculationType === "percentage" ? "(%)" : "(PHP)"}
            </label>
            <Input
              id="defaultValue"
              name="defaultValue"
              type="number"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder={calculationType === "percentage" ? "20" : "5000"}
              required
              step="0.01"
              min="0"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              {calculationType === "percentage"
                ? "Enter percentage value (e.g., 20 for 20%)"
                : "Enter peso amount (e.g., 5000 for P5,000)"}
            </p>
            {(state.errors as CreateDiscountTypeFormState["errors"])
              ?.defaultValue && (
              <p className="text-sm text-[var(--color-danger)]">
                {
                  (state.errors as CreateDiscountTypeFormState["errors"])!
                    .defaultValue![0]
                }
              </p>
            )}
          </div>

          {/* Display Order */}
          <div className="space-y-2">
            <label
              htmlFor="displayOrder"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Display Order
            </label>
            <Input
              id="displayOrder"
              name="displayOrder"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              min="0"
              className="w-24"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              Lower numbers appear first in dropdowns.
            </p>
          </div>

          {/* Boolean Options */}
          <div className="space-y-3 pt-2 border-t border-[var(--color-border)]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <input type="hidden" name="isActive" value={String(isActive)} />
              <span className="text-sm">Active (available for selection)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresDocumentation}
                onChange={(e) => setRequiresDocumentation(e.target.checked)}
                className="w-4 h-4"
              />
              <input
                type="hidden"
                name="requiresDocumentation"
                value={String(requiresDocumentation)}
              />
              <span className="text-sm">Requires supporting documentation</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isStackable}
                onChange={(e) => setIsStackable(e.target.checked)}
                className="w-4 h-4"
              />
              <input
                type="hidden"
                name="isStackable"
                value={String(isStackable)}
              />
              <span className="text-sm">Can be combined with other discounts</span>
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {isEditing ? "Save Changes" : "Create Discount Type"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
