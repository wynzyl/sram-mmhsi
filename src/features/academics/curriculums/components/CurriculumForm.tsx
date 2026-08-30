"use client";

import { useActionState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import {
  createCurriculumAction,
  updateCurriculumMetaAction,
} from "../curriculums.actions";
import type {
  CreateCurriculumFormState,
  UpdateCurriculumMetaFormState,
} from "../curriculums.schema";

interface CurriculumFormProps {
  mode: "create" | "edit";
  curriculum?: {
    id: string;
    name: string;
    description: string | null;
  };
}

export function CurriculumForm({ mode, curriculum }: CurriculumFormProps) {
  const router = useRouter();

  const [createState, createAction, createPending] = useActionState<
    CreateCurriculumFormState,
    FormData
  >(createCurriculumAction, {});

  const [updateState, updateAction, updatePending] = useActionState<
    UpdateCurriculumMetaFormState,
    FormData
  >(updateCurriculumMetaAction, {});

  const state = mode === "create" ? createState : updateState;
  const isPending = mode === "create" ? createPending : updatePending;
  const action = mode === "create" ? createAction : updateAction;

  useFormToast(state, {
    successMessage: mode === "create" ? "Curriculum created" : "Curriculum updated",
    onSuccess: () => {
      if (mode === "create" && "curriculumId" in state && state.curriculumId) {
        router.push(`/staff/academics/curriculums/${state.curriculumId}`);
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    },
  });

  return (
    <form action={action} className="space-y-6">
      {mode === "edit" && curriculum && (
        <input type="hidden" name="curriculumId" value={curriculum.id} />
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="name"
          className="block text-sm font-medium text-foreground"
        >
          Curriculum Name
          <span className="text-destructive ml-0.5">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="e.g., K-12 Standard Curriculum 2024"
          defaultValue={curriculum?.name ?? ""}
          required
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.name && (
          <p className="text-sm text-destructive">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className="block text-sm font-medium text-foreground"
        >
          Description
          <span className="text-muted-foreground ml-1">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Brief description of this curriculum..."
          defaultValue={curriculum?.description ?? ""}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.description && (
          <p className="text-sm text-destructive">{state.errors.description[0]}</p>
        )}
      </div>

      {/* Form-level errors are shown via useFormToast, field errors stay inline */}

      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
            ? "Create Curriculum"
            : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
