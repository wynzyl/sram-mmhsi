"use client";

import { useState, useCallback, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { updateFeeItemTypeAction } from "../fee-item-types.actions";
import { FEE_ITEM_CATEGORIES_LIST, FEE_ITEM_CATEGORY_LABELS, type UpdateFeeItemTypeFormState } from "../fee-item-types.schema";

type FeeItemType = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDiscount: boolean;
  displayOrder: number;
  isActive: boolean;
};

type Props = {
  feeType: FeeItemType;
};

const initialState: UpdateFeeItemTypeFormState = {};

export function EditFeeItemTypeModal({ feeType }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDiscount, setIsDiscount] = useState(feeType.isDiscount);
  const [state, formAction, isPending] = useActionState(updateFeeItemTypeAction, initialState);

  const openModal = useCallback(() => {
    setIsDiscount(feeType.isDiscount);
    setOpen(true);
  }, [feeType.isDiscount]);

  const closeModal = useCallback(() => setOpen(false), []);

  useFormToast(state, {
    successMessage: "Changes saved successfully",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <>
      <button type="button" className="fit-row-action" onClick={openModal} title="Edit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit
      </button>

      <Modal
        open={open}
        onClose={closeModal}
        aria-labelledby="edit-fit-title"
      >
        <ModalHeader
          onClose={closeModal}
          kicker="Finance · Fee Item Types"
        >
          <h2 id="edit-fit-title">Edit Fee Type</h2>
          <span className="fit-code-pill mt-1">{feeType.code}</span>
        </ModalHeader>

        <ModalBody>
          <form action={formAction} className="fin-form-stack">
                  <input type="hidden" name="id" value={feeType.id} />

                  {state.message && (
                    <div className="fin-callout fin-callout-warn">
                      <span className="fin-callout-icon">!</span>
                      <p className="fin-callout-body">{state.message}</p>
                    </div>
                  )}

                  {/* Code — read-only, codes are immutable */}
                  <div className="fit-field">
                    <label className="fit-label">Code</label>
                    <div className="fit-input fit-input-readonly">{feeType.code}</div>
                    <p className="fit-hint">Code cannot be changed after creation.</p>
                  </div>

                  {/* Name */}
                  <div className="fit-field">
                    <label htmlFor="edit-fit-name" className="fit-label">
                      Display Name <span className="fit-required">*</span>
                    </label>
                    <input
                      id="edit-fit-name"
                      name="name"
                      type="text"
                      className="fit-input"
                      defaultValue={feeType.name}
                      maxLength={80}
                      required
                    />
                    {state.errors?.name && (
                      <p className="fit-error">{state.errors.name[0]}</p>
                    )}
                  </div>

                  {/* Category + Order */}
                  <div className="fit-row">
                    <div className="fit-field fit-field-grow">
                      <label htmlFor="edit-fit-category" className="fit-label">
                        Category <span className="fit-required">*</span>
                      </label>
                      <select
                        id="edit-fit-category"
                        name="category"
                        className="fit-select"
                        defaultValue={feeType.category}
                        required
                      >
                        {FEE_ITEM_CATEGORIES_LIST.map((cat) => (
                          <option key={cat} value={cat}>
                            {FEE_ITEM_CATEGORY_LABELS[cat]}
                          </option>
                        ))}
                      </select>
                      {state.errors?.category && (
                        <p className="fit-error">{state.errors.category[0]}</p>
                      )}
                    </div>

                    <div className="fit-field fit-field-shrink">
                      <label htmlFor="edit-fit-order" className="fit-label">
                        Display Order
                      </label>
                      <input
                        id="edit-fit-order"
                        name="displayOrder"
                        type="number"
                        className="fit-input"
                        defaultValue={feeType.displayOrder}
                        min={0}
                        max={999}
                      />
                    </div>
                  </div>

                  {/* Discount toggle */}
                  <div className="fit-toggle-row">
                    <input
                      type="hidden"
                      name="isDiscount"
                      value={isDiscount ? "true" : "false"}
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isDiscount}
                      className={`fit-toggle ${isDiscount ? "fit-toggle-on" : ""}`}
                      onClick={() => setIsDiscount((v) => !v)}
                    >
                      <span className="fit-toggle-thumb" />
                    </button>
                    <div>
                      <p className="fit-toggle-label">This is a discount</p>
                      <p className="fit-toggle-sub">
                        Discount types subtract from the assessment total
                      </p>
                    </div>
                  </div>

            <div className="fin-form-actions fin-form-actions-border">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </>
  );
}
