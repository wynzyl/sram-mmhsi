"use client";

import { useActionState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useFormToast } from "@/hooks/useFormToast";
import { removeFromSectionAction } from "../section-assignments.actions";
import type { RemoveFromSectionFormState } from "../section-assignments.schema";

interface RemoveFromSectionButtonProps {
  enrollmentId: string;
  studentName: string;
}

export function RemoveFromSectionButton({
  enrollmentId,
  studentName,
}: RemoveFromSectionButtonProps) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState<
    RemoveFromSectionFormState,
    FormData
  >(removeFromSectionAction, {});

  useFormToast(state, {
    successMessage: `${studentName} removed from section.`,
    onSuccess: () => router.refresh(),
  });

  const handleClick = () => {
    if (!confirm(`Remove ${studentName} from their current section?`)) {
      return;
    }

    const formData = new FormData();
    formData.set("enrollmentId", enrollmentId);

    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
    >
      {isPending ? "..." : "Remove"}
    </Button>
  );
}
