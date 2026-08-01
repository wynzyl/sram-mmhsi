"use client";

import { useState, useCallback, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { ToggleSwitch } from "@/components/forms/ToggleSwitch";
import { updateFeeItemTypeAction } from "../fee-item-types.actions";
import { FEE_ITEM_CATEGORIES_LIST, FEE_ITEM_CATEGORY_LABELS, type UpdateFeeItemTypeFormState } from "../fee-item-types.schema";

type FeeItemType = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDiscount: boolean;
  isRefundable: boolean;
  displayOrder: number;
  isActive: boolean;
};

type Props = {
  feeType: FeeItemType;
};

const initialState: UpdateFeeItemTypeFormState = {};

const inputClasses = "block w-full px-3 py-2 text-sm text-foreground bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";
const selectClasses = "block w-full px-3 py-2 text-sm text-foreground bg-background border border-border rounded-md focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";
const readonlyClasses = "block w-full px-3 py-2 text-sm text-muted-foreground bg-muted border border-border rounded-md cursor-default";

export function EditFeeItemTypeModal({ feeType }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDiscount, setIsDiscount] = useState(feeType.isDiscount);
  const [isRefundable, setIsRefundable] = useState(feeType.isRefundable);
  const [state, formAction, isPending] = useActionState(updateFeeItemTypeAction, initialState);

  const openModal = useCallback(() => {
    setIsDiscount(feeType.isDiscount);
    setIsRefundable(feeType.isRefundable);
    setOpen(true);
  }, [feeType.isDiscount, feeType.isRefundable]);

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
      <button type="button" className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground bg-transparent border-none rounded cursor-pointer transition-colors hover:text-foreground hover:bg-muted" onClick={openModal} title="Edit">
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
          <span className="inline-flex px-2 py-0.5 text-xs font-mono bg-muted text-foreground rounded tracking-wide mt-1">{feeType.code}</span>
        </ModalHeader>

        <ModalBody>
          <form action={formAction} className="flex flex-col gap-4">
                  <input type="hidden" name="id" value={feeType.id} />

                  {state.message && (
                    <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-md">
                      <span className="shrink-0 flex items-center justify-center text-amber-500">!</span>
                      <p className="text-sm text-foreground m-0">{state.message}</p>
                    </div>
                  )}

                  {/* Code — read-only, codes are immutable */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.8125rem] font-medium text-foreground">Code</label>
                    <div className={readonlyClasses}>{feeType.code}</div>
                    <p className="text-xs text-muted-foreground m-0">Code cannot be changed after creation.</p>
                  </div>

                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-fit-name" className="text-[0.8125rem] font-medium text-foreground">
                      Display Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="edit-fit-name"
                      name="name"
                      type="text"
                      className={inputClasses}
                      defaultValue={feeType.name}
                      maxLength={80}
                      required
                    />
                    {state.errors?.name && (
                      <p className="text-xs text-destructive m-0">{state.errors.name[0]}</p>
                    )}
                  </div>

                  {/* Category + Order */}
                  <div className="flex gap-4">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <label htmlFor="edit-fit-category" className="text-[0.8125rem] font-medium text-foreground">
                        Category <span className="text-destructive">*</span>
                      </label>
                      <select
                        id="edit-fit-category"
                        name="category"
                        className={selectClasses}
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
                        <p className="text-xs text-destructive m-0">{state.errors.category[0]}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0 w-24">
                      <label htmlFor="edit-fit-order" className="text-[0.8125rem] font-medium text-foreground">
                        Display Order
                      </label>
                      <input
                        id="edit-fit-order"
                        name="displayOrder"
                        type="number"
                        className={inputClasses}
                        defaultValue={feeType.displayOrder}
                        min={0}
                        max={999}
                      />
                    </div>
                  </div>

                  {/* Discount toggle */}
                  <ToggleSwitch
                    name="isDiscount"
                    checked={isDiscount}
                    onChange={setIsDiscount}
                    label="This is a discount"
                    description="Discount types subtract from the assessment total"
                  />

                  {/* Refundable toggle */}
                  <ToggleSwitch
                    name="isRefundable"
                    checked={isRefundable}
                    onChange={setIsRefundable}
                    label="Refundable on cancellation"
                    description="Payments for this fee can be refunded when enrollment is cancelled within the cutoff period"
                    checkedColor="success"
                  />

            <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-border">
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
