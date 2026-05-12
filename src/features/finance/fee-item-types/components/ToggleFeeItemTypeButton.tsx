"use client";

import { useActionState } from "react";
import { toggleFeeItemTypeAction } from "../fee-item-types.actions";
import type { ToggleFeeItemTypeFormState } from "../fee-item-types.schema";

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
        className={`fit-row-action ${isActive ? "fit-row-action-warn" : "fit-row-action-ok"}`}
        title={isActive ? "Deactivate" : "Activate"}
      >
        {isPending ? "…" : isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}
