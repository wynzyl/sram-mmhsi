"use client";

import { useState, useEffect, useCallback, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (state.success) {
      const t = window.setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 600);
      return () => window.clearTimeout(t);
    }
  }, [state.success, router]);

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
      <Button onClick={openModal}>+ New Fee Type</Button>

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
            aria-labelledby="create-fit-title"
          >
            <div className="fin-modal-header">
              <div>
                <p className="fin-modal-kicker">Finance · Fee Item Types</p>
                <h2 id="create-fit-title" className="fin-modal-title">
                  New Fee Type
                </h2>
                <p className="fin-modal-sub">
                  Define a reusable fee type for use in templates
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
              {state.success ? (
                <div className="fin-callout fin-callout-success">
                  <span className="fin-callout-icon">✓</span>
                  <div>
                    <p className="fin-callout-title">Fee type created</p>
                    <p className="fin-callout-body">Closing…</p>
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
