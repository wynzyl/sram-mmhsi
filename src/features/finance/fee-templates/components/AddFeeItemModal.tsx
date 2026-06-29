"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { AddFeeItemForm } from "./AddFeeItemForm";

type FeeItemType = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDiscount: boolean;
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

  return (
    <>
      <Button
        onClick={openModal}
        disabled={allAdded}
        title={allAdded ? "All fee types already added" : undefined}
      >
        + Add Fee Item
      </Button>

      <Modal
        open={open}
        onClose={closeModal}
        aria-labelledby="add-fee-item-title"
      >
        <ModalHeader
          onClose={closeModal}
          kicker="Fee Template · Line Items"
          subtitle={`${availableOptions.length} fee type${availableOptions.length !== 1 ? "s" : ""} available to add`}
        >
          <h2 id="add-fee-item-title">Add Fee Item</h2>
        </ModalHeader>

        <ModalBody>
          {/* key forces full remount → fresh useActionState on every open */}
          <AddFeeItemForm
            key={formKey}
            templateId={templateId}
            availableOptions={availableOptions}
            onCancel={closeModal}
            onAdded={onAdded}
          />
        </ModalBody>
      </Modal>
    </>
  );
}
