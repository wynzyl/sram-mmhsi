"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import { cloneCurriculumAction } from "../curriculums.actions";
import type { CloneCurriculumFormState } from "../curriculums.schema";

type GradeLevelSummaryItem = {
  gradeLevelId: string;
  gradeLevelName: string;
  subjectCount: number;
};

interface CloneCurriculumFormProps {
  sourceCurriculumId: string;
  sourceCurriculumName: string;
  suggestedName: string;
  gradeLevelSummary: GradeLevelSummaryItem[];
}

export function CloneCurriculumForm({
  sourceCurriculumId,
  sourceCurriculumName,
  suggestedName,
  gradeLevelSummary,
}: CloneCurriculumFormProps) {
  const router = useRouter();

  const [state, action, isPending] = useActionState<
    CloneCurriculumFormState,
    FormData
  >(cloneCurriculumAction, {});

  useFormToast(state, {
    successMessage: "Draft curriculum created",
    onSuccess: () => {
      if (state.curriculumId) {
        router.push(`/staff/academics/curriculums/${state.curriculumId}`);
      }
    },
  });

  const totalSubjects = gradeLevelSummary.reduce(
    (sum, item) => sum + item.subjectCount,
    0
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="sourceCurriculumId" value={sourceCurriculumId} />

      {/* Draft Name Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="name"
          className="block text-sm font-medium text-foreground"
        >
          New Draft Name
          <span className="text-muted-foreground ml-1">(optional)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder={suggestedName}
          defaultValue={suggestedName}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.name && (
          <p className="text-sm text-destructive">{state.errors.name[0]}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Leave blank to use the suggested name with version number.
        </p>
      </div>

      {/* Subjects Preview */}
      {gradeLevelSummary.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Subjects to Copy ({totalSubjects})
          </p>
          <div className="bg-muted/30 border border-border rounded-md divide-y divide-border">
            {gradeLevelSummary.map((item) => (
              <div
                key={item.gradeLevelId}
                className="px-3 py-2 flex items-center justify-between text-sm"
              >
                <span>{item.gradeLevelName}</span>
                <span className="text-muted-foreground tabular-nums">
                  {item.subjectCount} subject{item.subjectCount !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form-level errors are shown via useFormToast, field errors stay inline */}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Creating Draft..." : "Create Draft"}
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
