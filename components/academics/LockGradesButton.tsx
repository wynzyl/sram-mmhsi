"use client";

import { useActionState } from "react";
import { lockGradesAction } from "@/actions/academics";

export function LockGradesButton({ assignmentId, gradingPeriod, isLocked }: { assignmentId: string, gradingPeriod: string, isLocked: boolean }) {
  const [state, formAction, isPending] = useActionState(lockGradesAction, {});

  if (isLocked) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        LOCKED
      </span>
    );
  }

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="gradingPeriod" value={gradingPeriod} />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-indigo-600 hover:text-indigo-900 disabled:opacity-50 transition-colors"
        onClick={(e) => {
          if (!confirm(`Are you sure you want to lock grades for ${gradingPeriod}? This cannot be undone.`)) {
            e.preventDefault();
          }
        }}
      >
        {isPending ? "Locking..." : "Lock"}
      </button>
      {state.errors?._form && (
        <span className="text-red-600 text-xs block mt-1">{state.errors._form[0]}</span>
      )}
    </form>
  );
}
