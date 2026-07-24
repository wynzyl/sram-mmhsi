"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useFormToast } from "@/hooks/useFormToast";
import type { GenerateSubjectOfferingsFormState } from "../subject-offerings.schema";
import { generateSubjectOfferingsAction } from "../subject-offerings.actions";

interface GenerateOfferingsButtonProps {
  sectionId: string;
  schoolYearId: string;
  hasExisting?: boolean;
}

export function GenerateOfferingsButton({
  sectionId,
  schoolYearId,
  hasExisting,
}: GenerateOfferingsButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, action, isPending] = useActionState<
    GenerateSubjectOfferingsFormState,
    FormData
  >(generateSubjectOfferingsAction, {});

  useFormToast(state, {
    successMessage: state.createdCount
      ? `Created ${state.createdCount} subject offering(s)${
          state.skippedCount ? `, skipped ${state.skippedCount} existing` : ""
        }`
      : "Subject offerings generated",
    onSuccess: () => {
      // Use startTransition to make refresh non-blocking
      startTransition(() => {
        router.refresh();
      });
    },
  });

  return (
    <form action={action}>
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="schoolYearId" value={schoolYearId} />
      <Button type="submit" disabled={isPending}>
        <Plus className="mr-2 h-4 w-4" />
        {isPending
          ? "Generating..."
          : hasExisting
            ? "Regenerate Offerings"
            : "Generate Offerings"}
      </Button>
    </form>
  );
}
