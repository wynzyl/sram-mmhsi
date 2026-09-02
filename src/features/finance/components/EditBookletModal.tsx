"use client";

import { useState, useCallback, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { updateBookletAction } from "@/features/payments/actions/booklets.actions";
import type { UpdateBookletFormState } from "@/features/payments/payments.schema";
import { formatStoredOrNumber } from "@/lib/utils/or-number";

type Booklet = {
  id: string;
  series: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  nextNumber: number;
  status: string;
  usageMode: "auto_only" | "manual_only";
  assignedToUsername: string | null;
};

type Cashier = {
  id: string;
  username: string;
  email: string;
};

type Props = {
  booklet: Booklet;
  cashiers: Cashier[];
  /** Currently assigned cashier ID (if any) */
  currentCashierId?: string | null;
};

const initialState: UpdateBookletFormState = {};

const selectClasses =
  "block w-full px-3 py-2 text-sm text-foreground bg-background border border-border rounded-md focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";
const readonlyClasses =
  "block w-full px-3 py-2 text-sm text-muted-foreground bg-muted border border-border rounded-md cursor-default";

const USAGE_MODE_OPTIONS = [
  { value: "auto_only", label: "Auto-assign only (cashier posting)" },
  { value: "manual_only", label: "Manual entry only (offline reconciliation)" },
] as const;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export function EditBookletModal({ booklet, cashiers, currentCashierId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateBookletAction, initialState);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  useFormToast(state, {
    successMessage: "Booklet updated successfully",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  // Calculate remaining OR numbers
  const remaining = booklet.endNumber - booklet.nextNumber + 1;
  const total = booklet.endNumber - booklet.startNumber + 1;
  const consumed = total - remaining;

  return (
    <>
      <button
        type="button"
        className="flex items-center justify-center w-8 h-8 text-muted-foreground bg-transparent border-none rounded-md cursor-pointer transition-colors hover:text-foreground hover:bg-muted"
        onClick={openModal}
        title="Edit booklet"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={closeModal} aria-labelledby="edit-booklet-title">
        <ModalHeader onClose={closeModal} kicker="Finance · Receipt Booklets">
          <h2 id="edit-booklet-title">Edit Receipt Booklet</h2>
          <span className="inline-flex px-2 py-0.5 text-xs font-mono bg-muted text-foreground rounded tracking-wide mt-1">
            {booklet.series}
          </span>
        </ModalHeader>

        <ModalBody>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="bookletId" value={booklet.id} />

            {state.message && (
              <div className="flex gap-3 p-4 bg-warning/10 border border-warning/30 rounded-md">
                <span className="shrink-0 flex items-center justify-center text-warning">!</span>
                <p className="text-sm text-foreground m-0">{state.message}</p>
              </div>
            )}

            {/* Read-only: Series & Prefix */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.8125rem] font-medium text-foreground">Series</label>
                <div className={readonlyClasses}>{booklet.series}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.8125rem] font-medium text-foreground">Prefix</label>
                <div className={readonlyClasses}>{booklet.prefix}</div>
              </div>
            </div>

            {/* Read-only: Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.8125rem] font-medium text-foreground">Start Number</label>
                <div className={readonlyClasses}>
                  {String(booklet.startNumber).padStart(5, "0")}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.8125rem] font-medium text-foreground">End Number</label>
                <div className={readonlyClasses}>
                  {String(booklet.endNumber).padStart(5, "0")}
                </div>
              </div>
            </div>

            {/* Read-only: Current OR & Progress */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.8125rem] font-medium text-foreground">Current OR Number</label>
              <div className={readonlyClasses}>
                {formatStoredOrNumber(booklet.prefix, booklet.nextNumber)}
              </div>
              <p className="text-xs text-muted-foreground m-0">
                {consumed} of {total} consumed ({remaining} remaining)
              </p>
            </div>

            <div className="border-t border-border my-2" />

            {/* Editable: Usage Mode */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-booklet-usageMode" className="text-[0.8125rem] font-medium text-foreground">
                Usage Mode <span className="text-destructive">*</span>
              </label>
              <select
                id="edit-booklet-usageMode"
                name="usageMode"
                className={selectClasses}
                defaultValue={booklet.usageMode}
                required
              >
                {USAGE_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {state.errors?.usageMode && (
                <p className="text-xs text-destructive m-0">{state.errors.usageMode[0]}</p>
              )}
              <p className="text-xs text-muted-foreground m-0">
                <strong>Auto:</strong> Appears in cashier dropdown for system-assigned OR numbers.
                <br />
                <strong>Manual:</strong> Reserved for offline receipts entered retroactively.
              </p>
            </div>

            {/* Editable: Assigned Cashier */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-booklet-cashier" className="text-[0.8125rem] font-medium text-foreground">
                Assigned Cashier
              </label>
              <select
                id="edit-booklet-cashier"
                name="assignedCashierId"
                className={selectClasses}
                defaultValue={currentCashierId ?? ""}
              >
                <option value="">— No assignment —</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.username} ({c.email})
                  </option>
                ))}
              </select>
              {state.errors?.assignedCashierId && (
                <p className="text-xs text-destructive m-0">{state.errors.assignedCashierId[0]}</p>
              )}
              <p className="text-xs text-muted-foreground m-0">
                Sets this booklet as the cashier&apos;s default for payment posting.
              </p>
            </div>

            {/* Editable: Status */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-booklet-status" className="text-[0.8125rem] font-medium text-foreground">
                Status <span className="text-destructive">*</span>
              </label>
              <select
                id="edit-booklet-status"
                name="status"
                className={selectClasses}
                defaultValue={booklet.status === "active" ? "active" : "inactive"}
                required
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {state.errors?.status && (
                <p className="text-xs text-destructive m-0">{state.errors.status[0]}</p>
              )}
              <p className="text-xs text-muted-foreground m-0">
                Setting to <strong>Inactive</strong> will prevent this booklet from being used for
                new payments, even if OR numbers remain.
              </p>
            </div>

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
