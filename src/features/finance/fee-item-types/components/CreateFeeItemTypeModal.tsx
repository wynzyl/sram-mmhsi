"use client";

import { useState, useCallback, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { createFeeItemTypeAction } from "../fee-item-types.actions";
import { FEE_ITEM_CATEGORIES_LIST, FEE_ITEM_CATEGORY_LABELS, type CreateFeeItemTypeFormState } from "../fee-item-types.schema";
import { cn } from "@/lib/utils/cn";

const initialState: CreateFeeItemTypeFormState = {};

const inputClasses = "block w-full px-3 py-2 text-sm text-foreground bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";
const selectClasses = "block w-full px-3 py-2 text-sm text-foreground bg-background border border-border rounded-md focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";

export function CreateFeeItemTypeModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDiscount, setIsDiscount] = useState(false);
  const [isRefundable, setIsRefundable] = useState(true); // Default to refundable
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
          <form action={formAction} className="flex flex-col gap-4">
                  {state.message && (
                    <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-md">
                      <span className="shrink-0 flex items-center justify-center text-amber-500">!</span>
                      <p className="text-sm text-foreground m-0">{state.message}</p>
                    </div>
                  )}

                  {/* Code */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fit-code" className="text-[0.8125rem] font-medium text-foreground">
                      Code <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="fit-code"
                      name="code"
                      type="text"
                      className={inputClasses}
                      placeholder="e.g. TUITION, LAB_FEE"
                      maxLength={20}
                      style={{ textTransform: "uppercase" }}
                      required
                    />
                    <p className="text-xs text-muted-foreground m-0">Unique short code. Letters, numbers, underscores only.</p>
                    {state.errors?.code && (
                      <p className="text-xs text-destructive m-0">{state.errors.code[0]}</p>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fit-name" className="text-[0.8125rem] font-medium text-foreground">
                      Display Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="fit-name"
                      name="name"
                      type="text"
                      className={inputClasses}
                      placeholder="e.g. Laboratory Fee"
                      maxLength={80}
                      required
                    />
                    {state.errors?.name && (
                      <p className="text-xs text-destructive m-0">{state.errors.name[0]}</p>
                    )}
                  </div>

                  {/* Category + Discount row */}
                  <div className="flex gap-4">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <label htmlFor="fit-category" className="text-[0.8125rem] font-medium text-foreground">
                        Category <span className="text-destructive">*</span>
                      </label>
                      <select id="fit-category" name="category" className={selectClasses} required>
                        <option value="">— select —</option>
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
                      <label htmlFor="fit-order" className="text-[0.8125rem] font-medium text-foreground">
                        Display Order
                      </label>
                      <input
                        id="fit-order"
                        name="displayOrder"
                        type="number"
                        className={inputClasses}
                        defaultValue={0}
                        min={0}
                        max={999}
                      />
                    </div>
                  </div>

                  {/* Discount toggle */}
                  <div className="flex items-start gap-3 py-2">
                    <input
                      type="hidden"
                      name="isDiscount"
                      value={isDiscount ? "true" : "false"}
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isDiscount}
                      className={cn(
                        "relative w-10 h-6 rounded-full border cursor-pointer shrink-0 transition-colors",
                        isDiscount ? "bg-primary border-primary" : "bg-muted border-border"
                      )}
                      onClick={() => setIsDiscount((v) => !v)}
                    >
                      <span className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                        isDiscount && "translate-x-4"
                      )} />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-foreground">This is a discount</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Discount types subtract from the assessment total
                      </p>
                    </div>
                  </div>

                  {/* Refundable toggle */}
                  <div className="flex items-start gap-3 py-2">
                    <input
                      type="hidden"
                      name="isRefundable"
                      value={isRefundable ? "true" : "false"}
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isRefundable}
                      className={cn(
                        "relative w-10 h-6 rounded-full border cursor-pointer shrink-0 transition-colors",
                        isRefundable ? "bg-green-500 border-green-500" : "bg-muted border-border"
                      )}
                      onClick={() => setIsRefundable((v) => !v)}
                    >
                      <span className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                        isRefundable && "translate-x-4"
                      )} />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-foreground">Refundable on cancellation</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Payments for this fee can be refunded when enrollment is cancelled within the cutoff period
                      </p>
                    </div>
                  </div>

            <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-border">
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
