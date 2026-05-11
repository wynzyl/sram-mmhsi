"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AddFeeItemForm } from "./AddFeeItemForm";

type FeeItemType = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDiscount: boolean;
  displayOrder: number;
};

type AddFeeItemModalProps = {
  templateId: string;
  availableFeeTypes: FeeItemType[];
  usedFeeTypeIds: Set<string>;
};

export function AddFeeItemModal({
  templateId,
  availableFeeTypes,
  usedFeeTypeIds,
}: AddFeeItemModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Increment to remount AddFeeItemForm, fully resetting useActionState
  const [formKey, setFormKey] = useState(0);

  const availableOptions = availableFeeTypes.filter(
    (ft) => !usedFeeTypeIds.has(ft.id)
  );
  const allAdded = availableOptions.length === 0;

  const openModal = useCallback(() => {
    setFormKey((k) => k + 1); // reset form state on every open
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  const onAdded = useCallback(() => {
    // Brief success pause, then close + refresh server data
    window.setTimeout(() => {
      setOpen(false);
      router.refresh();
    }, 700);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  return (
    <>
      <Button
        onClick={openModal}
        disabled={allAdded}
        title={allAdded ? "All fee types already added" : undefined}
      >
        + Add Fee Item
      </Button>

      {open && (
        <div
          className="fin-modal-backdrop"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className="fin-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-fee-item-title"
          >
            <div className="fin-modal-header">
              <div>
                <p className="fin-modal-kicker">Fee Template · Line Items</p>
                <h2 id="add-fee-item-title" className="fin-modal-title">
                  Add Fee Item
                </h2>
                <p className="fin-modal-sub">
                  {availableOptions.length} fee type
                  {availableOptions.length !== 1 ? "s" : ""} available to add
                </p>
              </div>
              <button
                type="button"
                className="fin-modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="fin-modal-body">
              {/* key forces full remount → fresh useActionState on every open */}
              <AddFeeItemForm
                key={formKey}
                templateId={templateId}
                availableOptions={availableOptions}
                onCancel={closeModal}
                onAdded={onAdded}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
