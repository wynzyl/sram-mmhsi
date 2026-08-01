"use client";

import { useActionState } from "react";
import { toggleFeeItemTypeAction } from "../fee-item-types.actions";
import type { ToggleFeeItemTypeFormState } from "../fee-item-types.schema";
import { cn } from "@/lib/utils/cn";

type Props = {
  id: string;
  isActive: boolean;
};

const initialState: ToggleFeeItemTypeFormState = {};

export function ToggleFeeItemTypeButton({ id, isActive }: Props) {
  const [, formAction, isPending] = useActionState(toggleFeeItemTypeAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isActive" value={(!isActive).toString()} />
      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-transparent border-none rounded cursor-pointer transition-colors",
          isActive
            ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950"
            : "text-success hover:text-success/80 hover:bg-success/10"
        )}
        title={isActive ? "Deactivate" : "Activate"}
      >
        {isPending ? "…" : isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}
