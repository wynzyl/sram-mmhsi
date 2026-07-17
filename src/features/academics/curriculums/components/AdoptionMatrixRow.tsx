"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import { updateAdoptionAction, removeAdoptionAction } from "../adoption.actions";
import { CurriculumStatusBadge } from "./CurriculumStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AdoptionMatrixCell, CurriculumDropdownOption } from "../curriculums.types";

interface AdoptionMatrixRowProps {
  cell: AdoptionMatrixCell;
  schoolYearId: string;
  curriculumOptions: CurriculumDropdownOption[];
  isLocked: boolean;
}

export function AdoptionMatrixRow({
  cell,
  schoolYearId,
  curriculumOptions,
  isLocked,
}: AdoptionMatrixRowProps) {
  const router = useRouter();
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>(
    cell.curriculumId ?? ""
  );
  const [isRemoving, startRemoveTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [updateState, updateAction, isUpdating] = useActionState(updateAdoptionAction, {});

  useFormToast(updateState, {
    successMessage: "Curriculum adoption updated",
    onSuccess: () => router.refresh(),
    // On failure the optimistic selection is stale (no refresh happens), so
    // restore the dropdown to the authoritative value from the cell.
    onError: () => setSelectedCurriculumId(cell.curriculumId ?? ""),
  });

  const handleCurriculumChange = (newCurriculumId: string) => {
    if (newCurriculumId === "" || newCurriculumId === selectedCurriculumId) {
      return;
    }

    setSelectedCurriculumId(newCurriculumId);

    // Auto-submit adoption change
    const formData = new FormData();
    formData.append("schoolYearId", schoolYearId);
    formData.append("gradeLevelId", cell.gradeLevelId);
    formData.append("curriculumId", newCurriculumId);
    updateAction(formData);
  };

  const handleRemove = () => {
    if (!cell.adoptionId) return;

    startRemoveTransition(async () => {
      const result = await removeAdoptionAction(cell.adoptionId!);
      if (result.success) {
        toast.success(result.message);
        setSelectedCurriculumId("");
        setConfirmRemove(false);
        router.refresh();
      } else {
        toast.error(result.message);
        setConfirmRemove(false);
      }
    });
  };

  const isPending = isUpdating || isRemoving;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      {/* Grade Level */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{cell.gradeLevelName}</span>
          {isLocked && (
            <svg
              className="w-4 h-4 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Locked: grades exist for this school year"
            >
              <title>Locked: grades exist for this school year</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          )}
        </div>
      </td>

      {/* Curriculum Dropdown */}
      <td className="px-4 py-3">
        <Select
          value={selectedCurriculumId || "none"}
          onValueChange={(value) => handleCurriculumChange(value === "none" ? "" : value)}
          disabled={isLocked || isPending}
        >
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Select curriculum..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>
              {cell.curriculumId ? "Select curriculum..." : "No curriculum adopted"}
            </SelectItem>
            {curriculumOptions.map((curr) => (
              <SelectItem key={curr.id} value={curr.id}>
                {curr.name} (v{curr.version})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {cell.curriculumStatus ? (
          <CurriculumStatusBadge status={cell.curriculumStatus} />
        ) : (
          <span className="text-xs text-muted-foreground">Not adopted</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        {cell.curriculumId && cell.adoptionId ? (
          confirmRemove ? (
            <div className="flex gap-2 justify-end items-center">
              <span className="text-xs text-muted-foreground">Remove?</span>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemove}
                disabled={isLocked || isPending}
                loading={isRemoving}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmRemove(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmRemove(true)}
              disabled={isLocked}
              title={
                isLocked
                  ? "Cannot remove adoption: grades exist for this school year"
                  : "Remove curriculum adoption"
              }
            >
              Remove
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>
    </tr>
  );
}
