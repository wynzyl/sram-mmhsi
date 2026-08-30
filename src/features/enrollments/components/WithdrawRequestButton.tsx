"use client";

import { useActionState } from "react";
import { withdrawCancellationRequestAction } from "../enrollment-cancellation.actions";
import { useFormToast } from "@/hooks/useFormToast";
import { cn } from "@/lib/utils/cn";
import { XCircle } from "lucide-react";

export interface WithdrawRequestButtonProps {
  requestId: string;
  /**
   * Visual variant
   */
  variant?: "button" | "link";
}

/**
 * Button to withdraw a pending cancellation request.
 * Only shown to the original requester.
 */
export default function WithdrawRequestButton({
  requestId,
  variant = "button",
}: WithdrawRequestButtonProps) {
  const [state, action, pending] = useActionState(withdrawCancellationRequestAction, {});

  useFormToast(state, {
    successMessage: "Cancellation request withdrawn.",
  });

  if (state.success) {
    return (
      <span className="text-xs text-success">Request withdrawn</span>
    );
  }

  return (
    <form action={action} className="inline">
      <input type="hidden" name="requestId" value={requestId} />

      {variant === "link" ? (
        <button
          type="submit"
          disabled={pending}
          className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
        >
          {pending ? "Withdrawing..." : "Withdraw request"}
        </button>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all",
            "hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <XCircle className="h-3.5 w-3.5" />
          {pending ? "Withdrawing..." : "Withdraw Request"}
        </button>
      )}

      {state.message && !state.success && (
        <p className="mt-1 text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}
