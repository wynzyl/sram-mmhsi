"use client";

import { useActionState, useState } from "react";
import { reverseDiscountAction } from "../discounts.actions";
import type {
  ReverseDiscountFormState,
  StudentDiscountView,
} from "../discounts.schema";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

interface DiscountReversalModalProps {
  discount: StudentDiscountView;
  onClose: () => void;
}

export default function DiscountReversalModal({
  discount,
  onClose,
}: DiscountReversalModalProps) {
  const [remarks, setRemarks] = useState("");

  const initialState: ReverseDiscountFormState = {};
  const [state, action, pending] = useActionState(
    reverseDiscountAction,
    initialState
  );

  useFormToast(state, {
    successMessage: "Discount reversed successfully",
    onSuccess: onClose,
  });

  return (
    <Modal
      open={true}
      onClose={onClose}
      size="sm"
      aria-labelledby="reverse-discount-title"
    >
      <ModalHeader onClose={onClose} kicker="Finance · Discounts">
        <h2 id="reverse-discount-title">Reverse Discount</h2>
      </ModalHeader>

      <ModalBody>
        <form action={action} className="space-y-4">
          <input
            type="hidden"
            name="studentDiscountId"
            value={discount.id}
          />

          {/* Discount Details */}
          <div className="p-3 bg-[var(--color-surface-2)] rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Discount:</span>
              <span className="font-medium">{discount.discountTypeName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Base Amount:</span>
              <CurrencyDisplay amount={Number(discount.baseAmount)} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">
                Discount Amount:
              </span>
              <span className="font-medium text-[var(--color-success)]">
                -<CurrencyDisplay amount={Number(discount.discountAmount)} className="inline" />
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 bg-[var(--color-warning-100)] border border-[var(--color-warning)] rounded-lg">
            <p className="text-sm text-[var(--color-warning-700)]">
              <strong>Warning:</strong> Reversing this discount will add{" "}
              <CurrencyDisplay amount={Number(discount.discountAmount)} className="inline font-medium" />{" "}
              back to the student&apos;s assessment balance. This action cannot be undone.
            </p>
          </div>

          {/* Reversal Reason */}
          <div className="space-y-2">
            <label
              htmlFor="reversalRemarks"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Reason for Reversal
            </label>
            <Input
              id="reversalRemarks"
              name="reversalRemarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Why is this discount being reversed?"
              required
              maxLength={500}
            />
            {state.errors?.reversalRemarks && (
              <p className="text-sm text-[var(--color-danger)]">
                {state.errors.reversalRemarks[0]}
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={pending}
              disabled={!remarks.trim()}
            >
              Reverse Discount
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
