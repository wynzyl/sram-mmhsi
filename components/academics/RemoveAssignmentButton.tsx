"use client";

import { useActionState } from "react";
import { removeAssignmentAction } from "@/actions/academics";

export function RemoveAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, isPending] = useActionState(removeAssignmentAction, {});

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-red-600 hover:text-red-900 disabled:opacity-50 transition-colors"
        onClick={(e) => {
          if (!confirm("Are you sure you want to remove this assignment?")) {
            e.preventDefault();
          }
        }}
      >
        {isPending ? "Removing..." : "Remove"}
      </button>
      {state.errors?._form && (
        <span className="text-red-600 text-xs block mt-1">{state.errors._form[0]}</span>
      )}
    </form>
  );
}
