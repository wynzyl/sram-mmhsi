"use client";

import { useState, useActionState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/forms/TextInputField";
import { useFormToast } from "@/hooks/useFormToast";
import { updateSpedFeeSettingsAction } from "../system-settings.actions";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

interface SpedFeeSettingsFormProps {
  currentAmount: number;
}

export function SpedFeeSettingsForm({ currentAmount }: SpedFeeSettingsFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(currentAmount));
  const [state, action, pending] = useActionState(updateSpedFeeSettingsAction, {});

  useFormToast(state, {
    successMessage: "SPED fee amount updated successfully",
    onSuccess: () => {
      router.refresh();
    },
  });

  return (
    <form
      action={(formData) => {
        startTransition(() => action(formData));
      }}
      className="space-y-4"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <TextInputField
            label="SPED Fee Amount (PHP)"
            name="spedFeeAmount"
            type="number"
            value={amount}
            onChange={setAmount}
            required
            error={state.errors?.spedFeeAmount}
          />
          <p className="mt-1 text-sm text-muted-foreground">
            This amount will be automatically added to assessments for students marked as SPED.
          </p>
        </div>
        <div className="pt-6">
          <Button type="submit" disabled={pending || !amount || Number(amount) < 0}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {state.success && state.savedAt && (
        <p className="text-sm text-success">
          Last saved: {new Date(state.savedAt).toLocaleString("en-PH")}
        </p>
      )}

      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-sm">
          <span className="font-medium">Current configured amount:</span>{" "}
          <CurrencyDisplay amount={currentAmount} className="font-semibold text-primary" />
        </p>
      </div>
    </form>
  );
}
