"use client";

import { useActionState, useState } from "react";
import {
  createDiscountTypeAction,
  updateDiscountTypeAction,
} from "../discounts.actions";
import type {
  CreateDiscountTypeFormState,
  UpdateDiscountTypeFormState,
  DiscountTypeView,
} from "../discounts.schema";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleSwitch } from "@/components/forms/ToggleSwitch";

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
    isEditing ? updateDiscountTypeAction : createDiscountTypeAction,
    initialState
  );

  useFormToast(state, {
    successMessage: isEditing
      ? "Discount type updated successfully"
      : "Discount type created successfully",
    onSuccess: onClose,
  });

  return (
    <Modal
      open={true}
      onClose={onClose}
      aria-labelledby="discount-type-modal-title"
    >
      <ModalHeader onClose={onClose} kicker="Finance · Discounts">
        <h2 id="discount-type-modal-title">
          {isEditing ? "Edit Discount Type" : "Create Discount Type"}
        </h2>
      </ModalHeader>

      <ModalBody>
        <form action={action} className="space-y-4">
          {isEditing && (
            <input type="hidden" name="id" value={discountType.id} />
          )}

          {/* Code */}
          <div className="space-y-2">
            <label
              htmlFor="code"
              className="text-sm font-medium text-foreground"
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
            <p className="text-xs text-muted-foreground">
              Uppercase letters, numbers, and underscores only.
            </p>
            {(state.errors as CreateDiscountTypeFormState["errors"])?.code && (
              <p className="text-sm text-destructive">
                {(state.errors as CreateDiscountTypeFormState["errors"])!.code![0]}
              </p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-foreground"
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
              <p className="text-sm text-destructive">
                {(state.errors as CreateDiscountTypeFormState["errors"])!.name![0]}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="description"
              className="text-sm font-medium text-foreground"
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
              <label className="text-sm font-medium text-foreground">
                Calculation Type
              </label>
              <select
                name="calculationType"
                value={calculationType}
                onChange={(e) =>
                  setCalculationType(e.target.value as "fixed_amount" | "percentage")
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (PHP)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Applies To
              </label>
              <select
                name="baseType"
                value={baseType}
                onChange={(e) =>
                  setBaseType(e.target.value as "tuition_only" | "full_assessment")
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
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
              className="text-sm font-medium text-foreground"
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
            <p className="text-xs text-muted-foreground">
              {calculationType === "percentage"
                ? "Enter percentage value (e.g., 20 for 20%)"
                : "Enter peso amount (e.g., 5000 for P5,000)"}
            </p>
            {(state.errors as CreateDiscountTypeFormState["errors"])
              ?.defaultValue && (
              <p className="text-sm text-destructive">
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
              className="text-sm font-medium text-foreground"
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
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in dropdowns.
            </p>
          </div>

          {/* Boolean Options */}
          <div className="space-y-1 pt-2 border-t border-border">
            <ToggleSwitch
              name="isActive"
              checked={isActive}
              onChange={setIsActive}
              label="Active"
              description="Available for selection when applying discounts"
              checkedColor="green"
            />

            <ToggleSwitch
              name="requiresDocumentation"
              checked={requiresDocumentation}
              onChange={setRequiresDocumentation}
              label="Requires documentation"
              description="Supporting documents must be submitted for this discount"
              checkedColor="amber"
            />

            <ToggleSwitch
              name="isStackable"
              checked={isStackable}
              onChange={setIsStackable}
              label="Stackable"
              description="Can be combined with other discounts on the same assessment"
              checkedColor="blue"
            />
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
      </ModalBody>
    </Modal>
  );
}
