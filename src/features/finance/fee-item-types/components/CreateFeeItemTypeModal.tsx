"use client";

import { useState, useCallback, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { createFeeItemTypeAction } from "../fee-item-types.actions";
import { FEE_ITEM_CATEGORIES_LIST, FEE_ITEM_CATEGORY_LABELS, type CreateFeeItemTypeFormState } from "../fee-item-types.schema";

const initialState: CreateFeeItemTypeFormState = {};

export function CreateFeeItemTypeModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDiscount, setIsDiscount] = useState(false);
  const [state, formAction, isPending] = useActionState(createFeeItemTypeAction, initialState);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  useFormToast(state, {
    successMessage: "Fee type created successfully",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <>
      <Button onClick={openModal}>+ New Fee Type</Button>

      <Modal
        open={open}
        onClose={closeModal}
        aria-labelledby="create-fit-title"
      >
        <ModalHeader
          onClose={closeModal}
          kicker="Finance · Fee Item Types"
          subtitle="Define a reusable fee type for use in templates"
        >
          <h2 id="create-fit-title">New Fee Type</h2>
        </ModalHeader>

        <ModalBody>
          <form action={formAction} className="fin-form-stack">
                  {state.message && (
                    <div className="fin-callout fin-callout-warn">
                      <span className="fin-callout-icon">!</span>
                      <p className="fin-callout-body">{state.message}</p>
                    </div>
                  )}

                  {/* Code */}
                  <div className="fit-field">
                    <label htmlFor="fit-code" className="fit-label">
                      Code <span className="fit-required">*</span>
                    </label>
                    <input
                      id="fit-code"
                      name="code"
                      type="text"
                      className="fit-input"
                      placeholder="e.g. TUITION, LAB_FEE"
                      maxLength={20}
                      style={{ textTransform: "uppercase" }}
                      required
                    />
                    <p className="fit-hint">Unique short code. Letters, numbers, underscores only.</p>
                    {state.errors?.code && (
                      <p className="fit-error">{state.errors.code[0]}</p>
                    )}
                  </div>

                  {/* Name */}
                  <div className="fit-field">
                    <label htmlFor="fit-name" className="fit-label">
                      Display Name <span className="fit-required">*</span>
                    </label>
                    <input
                      id="fit-name"
                      name="name"
                      type="text"
                      className="fit-input"
                      placeholder="e.g. Laboratory Fee"
                      maxLength={80}
                      required
                    />
                    {state.errors?.name && (
                      <p className="fit-error">{state.errors.name[0]}</p>
                    )}
                  </div>

                  {/* Category + Discount row */}
                  <div className="fit-row">
                    <div className="fit-field fit-field-grow">
                      <label htmlFor="fit-category" className="fit-label">
                        Category <span className="fit-required">*</span>
                      </label>
                      <select id="fit-category" name="category" className="fit-select" required>
                        <option value="">— select —</option>
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
                      <label htmlFor="fit-order" className="fit-label">
                        Display Order
                      </label>
                      <input
                        id="fit-order"
                        name="displayOrder"
                        type="number"
                        className="fit-input"
                        defaultValue={0}
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
                {isPending ? "Creating…" : "Create Fee Type"}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </>
  );
}
