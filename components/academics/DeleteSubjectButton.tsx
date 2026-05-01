"use client";

import { useActionState } from "react";
import { deleteSubjectAction } from "@/actions/academics";

export function DeleteSubjectButton({ subjectId }: { subjectId: string }) {
  const [state, formAction, isPending] = useActionState(deleteSubjectAction, {});

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="subjectId" value={subjectId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-red-600 hover:text-red-900 disabled:opacity-50 transition-colors"
        onClick={(e) => {
          if (!confirm("Are you sure you want to delete this subject?")) {
            e.preventDefault();
          }
        }}
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
      {state.errors?._form && (
        <span className="text-red-600 text-xs block mt-1">{state.errors._form[0]}</span>
      )}
    </form>
  );
}
