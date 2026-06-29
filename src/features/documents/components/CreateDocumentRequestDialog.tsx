"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormToast } from "@/hooks/useFormToast";
import { createDocumentRequestAction } from "../document-requests.actions";
import type { CreateDocumentRequestFormState } from "../document-requests.schema";
import {
  DOCUMENT_REQUEST_TYPES,
  DOCUMENT_REQUEST_TYPE_LABELS,
  DOCUMENT_REQUEST_TYPE_DESCRIPTIONS,
} from "@/lib/constants/document-requests";

type SchoolYearOption = { id: string; label: string };

export function CreateDocumentRequestDialog({
  studentId,
  studentName,
  schoolYearOptions,
  onClose,
}: {
  studentId: string;
  studentName: string;
  schoolYearOptions: SchoolYearOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, action, isPending] = useActionState<
    CreateDocumentRequestFormState,
    FormData
  >(createDocumentRequestAction, {});

  const [selectedType, setSelectedType] = useState<string>("");

  useFormToast(state, {
    successMessage: "Document request created successfully",
    onSuccess: () => {
      // Close dialog first, then refresh in a transition to avoid blocking
      onClose();
      startTransition(() => {
        router.refresh();
      });
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Document Request</DialogTitle>
          <DialogDescription>
            Requesting document for <strong>{studentName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium">
              Document Type <span className="text-destructive">*</span>
            </label>
            <select
              name="documentType"
              required
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select document type...</option>
              {DOCUMENT_REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_REQUEST_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {selectedType && (
              <p className="mt-1 text-xs text-muted-foreground">
                {DOCUMENT_REQUEST_TYPE_DESCRIPTIONS[selectedType as keyof typeof DOCUMENT_REQUEST_TYPE_DESCRIPTIONS]}
              </p>
            )}
            {state.errors?.documentType && (
              <p className="mt-1 text-sm text-destructive">
                {state.errors.documentType[0]}
              </p>
            )}
          </div>

          {/* School Year (Optional) */}
          <div>
            <label className="block text-sm font-medium">
              School Year (Optional)
            </label>
            <select
              name="schoolYearId"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select school year...</option>
              {schoolYearOptions.map((sy) => (
                <option key={sy.id} value={sy.id}>
                  {sy.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Specify if the document is for a specific school year
            </p>
          </div>

          {/* Number of Copies */}
          <div>
            <label className="block text-sm font-medium">
              Number of Copies <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              name="copies"
              defaultValue={1}
              min={1}
              max={10}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {state.errors?.copies && (
              <p className="mt-1 text-sm text-destructive">
                {state.errors.copies[0]}
              </p>
            )}
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium">Purpose</label>
            <input
              type="text"
              name="purpose"
              placeholder="e.g., Employment, Further Studies, Travel..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {state.errors?.purpose && (
              <p className="mt-1 text-sm text-destructive">
                {state.errors.purpose[0]}
              </p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium">Remarks</label>
            <textarea
              name="remarks"
              rows={3}
              placeholder="Additional notes or instructions..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {state.errors?.remarks && (
              <p className="mt-1 text-sm text-destructive">
                {state.errors.remarks[0]}
              </p>
            )}
          </div>

          {/* Actions */}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create Request"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
