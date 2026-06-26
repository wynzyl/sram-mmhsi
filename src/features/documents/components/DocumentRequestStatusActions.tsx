"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import {
  processDocumentRequestAction,
  readyDocumentRequestAction,
  releaseDocumentRequestAction,
  rejectDocumentRequestAction,
  cancelDocumentRequestAction,
} from "../document-requests.actions";
import type {
  ProcessDocumentRequestFormState,
  ReadyDocumentRequestFormState,
  ReleaseDocumentRequestFormState,
  RejectDocumentRequestFormState,
  CancelDocumentRequestFormState,
} from "../document-requests.schema";
import type { DocumentRequestDetail } from "../document-requests.queries";

// ─── Process Action (requested → processing) ─────────────────────────────────

export function ProcessDocumentRequestForm({
  request,
  onSuccess,
  canProcess = true,
  processBlockReason,
}: {
  request: DocumentRequestDetail;
  onSuccess?: () => void;
  canProcess?: boolean;
  processBlockReason?: string;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<
    ProcessDocumentRequestFormState,
    FormData
  >(processDocumentRequestAction, {});

  useFormToast(state, {
    successMessage: "Document request is now being processed",
    onSuccess: () => {
      router.refresh();
      onSuccess?.();
    },
  });

  // Show block message if processing is not allowed
  if (!canProcess) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <h4 className="font-medium text-amber-800 dark:text-amber-200">
          Cannot Process Document
        </h4>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          {processBlockReason}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="requestId" value={request.id} />

      <div>
        <label className="block text-sm font-medium">
          Fee Amount (Optional)
        </label>
        <input
          type="number"
          name="feeAmount"
          step="0.01"
          min="0"
          placeholder="0.00"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {state.errors?.feeAmount && (
          <p className="mt-1 text-sm text-destructive">
            {state.errors.feeAmount[0]}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Remarks</label>
        <textarea
          name="remarks"
          rows={2}
          placeholder="Processing notes..."
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Processing..." : "Start Processing"}
      </button>
    </form>
  );
}

// ─── Ready Action (processing → ready) ───────────────────────────────────────

export function ReadyDocumentRequestForm({
  request,
  onSuccess,
}: {
  request: DocumentRequestDetail;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<
    ReadyDocumentRequestFormState,
    FormData
  >(readyDocumentRequestAction, {});

  useFormToast(state, {
    successMessage: "Document marked as ready for release",
    onSuccess: () => {
      router.refresh();
      onSuccess?.();
    },
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="requestId" value={request.id} />

      {/* Document number is auto-generated at process stage - display read-only */}
      {request.documentNumber && (
        <div>
          <label className="block text-sm font-medium text-muted-foreground">
            Document Number
          </label>
          <div className="mt-1 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono">
            {request.documentNumber}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">Remarks</label>
        <textarea
          name="remarks"
          rows={2}
          placeholder="Additional notes..."
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isPending ? "Marking Ready..." : "Mark as Ready"}
      </button>
    </form>
  );
}

// ─── Release Action (ready → released) ───────────────────────────────────────

export function ReleaseDocumentRequestForm({
  request,
  canRelease,
  releaseBlockReason,
  onSuccess,
}: {
  request: DocumentRequestDetail;
  canRelease: boolean;
  releaseBlockReason?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<
    ReleaseDocumentRequestFormState,
    FormData
  >(releaseDocumentRequestAction, {});

  useFormToast(state, {
    successMessage: "Document released successfully",
    onSuccess: () => {
      router.refresh();
      onSuccess?.();
    },
  });

  if (!canRelease) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <h4 className="font-medium text-amber-800 dark:text-amber-200">
          Cannot Release Document
        </h4>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          {releaseBlockReason}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="requestId" value={request.id} />

      <div>
        <label className="block text-sm font-medium">
          Release Remarks (Optional)
        </label>
        <textarea
          name="remarks"
          rows={2}
          placeholder="Notes about the release..."
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
        <p className="text-sm text-green-800 dark:text-green-200">
          The student has cleared all balances and clearances. Document is ready
          for release.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isPending ? "Releasing..." : "Release Document"}
      </button>
    </form>
  );
}

// ─── Reject Action ───────────────────────────────────────────────────────────

export function RejectDocumentRequestForm({
  request,
  onSuccess,
}: {
  request: DocumentRequestDetail;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<
    RejectDocumentRequestFormState,
    FormData
  >(rejectDocumentRequestAction, {});

  useFormToast(state, {
    successMessage: "Document request rejected",
    onSuccess: () => {
      router.refresh();
      onSuccess?.();
    },
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="requestId" value={request.id} />

      <div>
        <label className="block text-sm font-medium">
          Rejection Reason <span className="text-destructive">*</span>
        </label>
        <textarea
          name="rejectedReason"
          rows={3}
          required
          placeholder="Explain why the request is being rejected..."
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {state.errors?.rejectedReason && (
          <p className="mt-1 text-sm text-destructive">
            {state.errors.rejectedReason[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
      >
        {isPending ? "Rejecting..." : "Reject Request"}
      </button>
    </form>
  );
}

// ─── Cancel Action ───────────────────────────────────────────────────────────

export function CancelDocumentRequestForm({
  request,
  onSuccess,
}: {
  request: DocumentRequestDetail;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<
    CancelDocumentRequestFormState,
    FormData
  >(cancelDocumentRequestAction, {});

  useFormToast(state, {
    successMessage: "Document request cancelled",
    onSuccess: () => {
      router.refresh();
      onSuccess?.();
    },
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="requestId" value={request.id} />

      <div>
        <label className="block text-sm font-medium">
          Cancellation Remarks (Optional)
        </label>
        <textarea
          name="remarks"
          rows={2}
          placeholder="Reason for cancellation..."
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80 disabled:opacity-50"
      >
        {isPending ? "Cancelling..." : "Cancel Request"}
      </button>
    </form>
  );
}

// ─── Print/Download Document Button ───────────────────────────────────────────

import { useState, useCallback } from "react";

/**
 * Button to print/download an official document PDF.
 * Opens the PDF in a new tab for print preview.
 */
export function PrintDocumentButton({
  requestId,
  documentNumber,
  variant = "primary",
  disabled = false,
  disabledReason,
}: {
  requestId: string;
  documentNumber?: string | null;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = useCallback(async () => {
    if (disabled) return;
    setIsLoading(true);
    try {
      // Open the PDF in a new tab for print/download
      const url = `/staff/archive/documents/${requestId}/export?format=pdf`;
      window.open(url, "_blank");
    } finally {
      // Small delay to prevent button flicker
      setTimeout(() => setIsLoading(false), 500);
    }
  }, [requestId, disabled]);

  const buttonClass =
    variant === "primary"
      ? "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      : "rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handlePrint}
        disabled={isLoading || disabled}
        className={`${buttonClass} w-full`}
        title={disabled ? disabledReason : undefined}
      >
        {isLoading ? (
          "Opening..."
        ) : (
          <>
            <span className="mr-2">📄</span>
            {documentNumber ? `Print ${documentNumber}` : "Print Document"}
          </>
        )}
      </button>
      {disabled && disabledReason && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {disabledReason}
        </p>
      )}
    </div>
  );
}

/**
 * Download button that triggers a file download instead of opening in new tab.
 */
export function DownloadDocumentButton({
  requestId,
  documentNumber,
  disabled = false,
  disabledReason,
}: {
  requestId: string;
  documentNumber?: string | null;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (disabled) return;
    setIsLoading(true);
    try {
      const url = `/staff/archive/documents/${requestId}/export?format=pdf`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `document-${requestId}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [requestId, disabled]);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isLoading || disabled}
        className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        title={disabled ? disabledReason : undefined}
      >
        {isLoading ? (
          "Downloading..."
        ) : (
          <>
            <span className="mr-2">⬇️</span>
            {documentNumber ? `Download ${documentNumber}` : "Download PDF"}
          </>
        )}
      </button>
      {disabled && disabledReason && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {disabledReason}
        </p>
      )}
    </div>
  );
}
