"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TextInputField, TextAreaField } from "@/components/forms/TextInputField";
import { useFormToast } from "@/hooks/useFormToast";
import {
  addSpecialFeeAction,
  removeSpecialFeeAction,
} from "../assessments.actions";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

interface SpecialEducationFeeManagementProps {
  assessmentId: string;
  existingSpedItem: {
    id: string;
    amount: string;
  } | null;
  /** Whether any payments have been allocated to the SPED fee item */
  hasAllocatedPayments: boolean;
  /** Whether user has permission to modify assessments */
  canModify: boolean;
  /** Whether the assessment is cancelled or fully paid */
  isLocked: boolean;
  /** Configured SPED fee amount from system settings */
  defaultSpedFeeAmount: number;
  /** Whether the student is marked as a SPED student */
  isSpedStudent: boolean;
}

export default function SpecialEducationFeeManagement({
  assessmentId,
  existingSpedItem,
  hasAllocatedPayments,
  canModify,
  isLocked,
  defaultSpedFeeAmount,
  isSpedStudent,
}: SpecialEducationFeeManagementProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultSpedFeeAmount));
  const [addReason, setAddReason] = useState("");
  const [removeReason, setRemoveReason] = useState("");

  const [addState, addAction, addPending] = useActionState(addSpecialFeeAction, {});
  const [removeState, removeAction, removePending] = useActionState(removeSpecialFeeAction, {});

  useFormToast(addState, {
    successMessage: "Special Education fee added successfully",
    onSuccess: () => {
      setAddOpen(false);
      setAmount(String(defaultSpedFeeAmount));
      setAddReason("");
      router.refresh();
    },
  });

  useFormToast(removeState, {
    successMessage: "Special Education fee removed successfully",
    onSuccess: () => {
      setRemoveOpen(false);
      setRemoveReason("");
      router.refresh();
    },
  });

  if (!canModify || isLocked) {
    // Show read-only badge if SPED fee exists
    if (existingSpedItem) {
      return (
        <span className="inline-flex items-center justify-center gap-[0.45rem] h-[38px] min-w-[140px] px-4 rounded-md border border-info/30 bg-info/10 text-[13px] font-semibold tracking-[0.005em] text-info">
          <span className="inline-flex h-2 w-2 rounded-full bg-info" />
          SPED
        </span>
      );
    }
    return null;
  }

  // User can modify
  if (existingSpedItem) {
    // Show remove button
    return (
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            disabled={hasAllocatedPayments}
            title={hasAllocatedPayments ? "Cannot remove: payments have been allocated" : "Remove SPED fee"}
            className="inline-flex items-center justify-center gap-[0.45rem] h-[38px] min-w-[140px] px-4 bg-info/10 text-info text-[13px] font-semibold tracking-[0.005em] border border-info/30 rounded-md cursor-pointer transition-colors hover:bg-info/20 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-info" />
            SPED
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Special Education Fee</DialogTitle>
            <DialogDescription>
              This will remove the SPED fee of{" "}
              <CurrencyDisplay amount={Number(existingSpedItem.amount)} className="font-semibold" />{" "}
              from this assessment and recalculate the totals.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(formData) => {
              formData.set("assessmentItemId", existingSpedItem.id);
              removeAction(formData);
            }}
          >
            <div className="py-4">
              <TextAreaField
                label="Reason for removal"
                name="reason"
                value={removeReason}
                onChange={setRemoveReason}
                required
                rows={3}
                placeholder="e.g., Student no longer requires SPED services"
                error={removeState.errors?.reason}
              />
              {removeState.message && (
                <p className="mt-2 text-sm text-red-600">{removeState.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRemoveOpen(false)}
                disabled={removePending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={removePending || !removeReason.trim()}>
                {removePending ? "Removing..." : "Remove SPED Fee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // No SPED fee - only show add button for SPED students
  if (!isSpedStudent) {
    return null;
  }

  return (
    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-[0.45rem] h-[38px] min-w-[140px] px-4 bg-card text-foreground text-[13px] font-semibold tracking-[0.005em] border border-border rounded-md cursor-pointer transition-colors hover:bg-muted active:translate-y-px focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          + SPED
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Special Education Fee</DialogTitle>
          <DialogDescription>
            Add a SPED fee to this assessment. The default amount is{" "}
            <CurrencyDisplay amount={defaultSpedFeeAmount} className="font-semibold" />
            , but you can adjust it below.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(formData) => {
            formData.set("assessmentId", assessmentId);
            addAction(formData);
          }}
        >
          <input type="hidden" name="assessmentId" value={assessmentId} />

          <div className="space-y-4 py-4">
            <TextInputField
              label="Amount (PHP)"
              name="amount"
              type="number"
              value={amount}
              onChange={setAmount}
              required
              error={addState.errors?.amount}
            />
            <TextAreaField
              label="Reason (optional)"
              name="reason"
              value={addReason}
              onChange={setAddReason}
              rows={2}
              placeholder="e.g., Student identified for SPED services mid-year"
              error={addState.errors?.reason}
            />
            {addState.message && (
              <p className="text-sm text-red-600">{addState.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddOpen(false)}
              disabled={addPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addPending || !amount || Number(amount) <= 0}>
              {addPending ? "Adding..." : "Add SPED Fee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
