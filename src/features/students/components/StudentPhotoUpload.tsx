"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Camera, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from "@/lib/toast";
import {
  PHOTO_ACCEPT_STRING,
  MAX_PHOTO_SIZE_DISPLAY,
  ALLOWED_PHOTO_EXTENSIONS,
  getPhotoValidationError,
} from "@/features/students/students-photo.schema";

// ─── Types ─────────────────────────────────────────────────────────────────────

type UploadState = "idle" | "preview" | "uploading" | "confirm-remove";

export type StudentPhotoUploadProps = {
  /** Student ID for API calls */
  studentId: string;
  /** Student reference number (used in initials fallback) */
  referenceNumber: string;
  /** Current photo URL or null */
  currentPhotoUrl: string | null;
  /** Initials to display when no photo exists */
  initials: string;
  /** Whether the user can edit (has students:update permission) */
  canEdit: boolean;
};

// ─── Avatar Button Styles ───────────────────────────────────────────────────────

const avatarBaseStyles = cn(
  "flex h-28 w-28 shrink-0 items-center justify-center",
  "rounded-2xl border-4 border-card bg-muted shadow-md",
  "transition-all sm:h-32 sm:w-32 print:border-border"
);

const avatarEditableStyles = "cursor-pointer hover:ring-2 hover:ring-primary/50";
const avatarDisabledStyles = "cursor-default";
const avatarUploadingStyles = "opacity-50";

const avatarOverlayStyles = cn(
  "absolute inset-0 flex items-center justify-center",
  "rounded-xl bg-black/50 opacity-0 transition-opacity hover:opacity-100"
);

const avatarLoadingOverlayStyles = cn(
  "absolute inset-0 flex items-center justify-center rounded-xl bg-black/50"
);

const spinnerStyles = cn(
  "h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"
);

const initialsStyles = cn(
  "font-display text-3xl font-bold tracking-tight text-foreground"
);

const previewContainerStyles = cn(
  "relative h-48 w-48 overflow-hidden rounded-2xl border-4 border-border bg-muted shadow-md"
);

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Interactive photo upload component for student profiles.
 *
 * Behavior:
 * - No photo + click → opens file picker
 * - Has photo + click → shows dropdown with change/remove options
 * - File selected → shows preview in AlertDialog with Upload/Cancel
 * - Upload → spinner, POST to API, toast on success/error
 * - Remove → confirm dialog, DELETE to API
 */
export function StudentPhotoUpload({
  studentId,
  referenceNumber,
  currentPhotoUrl,
  initials,
  canEdit,
}: StudentPhotoUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File Selection ────────────────────────────────────────────────────────

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Client-side validation
      const error = getPhotoValidationError(file);
      if (error) {
        showError(error);
        e.target.value = "";
        return;
      }

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setSelectedFile(file);
      setState("preview");

      // Reset input for re-selection
      e.target.value = "";
    },
    []
  );

  // ─── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setState("uploading");

    try {
      const formData = new FormData();
      formData.append("photo", selectedFile);

      const response = await fetch(`/api/students/${studentId}/photo`, {
        method: "POST",
        body: formData,
      });

      // Validate response before parsing JSON
      const text = await response.text();
      if (!text) {
        throw new Error("Server returned empty response");
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch {
        console.error("Invalid JSON response:", text.slice(0, 200));
        throw new Error("Server returned invalid response");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload photo");
      }

      // Update local state with new photo URL
      setPhotoUrl(result.photoUrl);
      showSuccess("Photo uploaded successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload photo";
      showError(message);
    } finally {
      // Cleanup
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setSelectedFile(null);
      setState("idle");
    }
  }, [selectedFile, studentId, previewUrl]);

  // ─── Remove ────────────────────────────────────────────────────────────────

  const handleRemove = useCallback(async () => {
    setState("uploading");

    try {
      const response = await fetch(`/api/students/${studentId}/photo`, {
        method: "DELETE",
      });

      // Validate response before parsing JSON
      const text = await response.text();
      if (!text) {
        throw new Error("Server returned empty response");
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch {
        console.error("Invalid JSON response:", text.slice(0, 200));
        throw new Error("Server returned invalid response");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to remove photo");
      }

      setPhotoUrl(null);
      showSuccess("Photo removed successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove photo";
      showError(message);
    } finally {
      setState("idle");
    }
  }, [studentId]);

  // ─── Cancel ────────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setState("idle");
  }, [previewUrl]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const isUploading = state === "uploading";

  // Avatar content (photo or initials)
  const avatarContent = photoUrl ? (
    <Image
      src={photoUrl}
      alt="Student photo"
      width={128}
      height={128}
      className="h-full w-full rounded-xl object-cover"
      priority
    />
  ) : (
    <span className={initialsStyles} aria-hidden>
      {initials || "—"}
    </span>
  );

  // Edit overlay (camera icon on hover)
  const editOverlay = canEdit && !isUploading && (
    <div className={avatarOverlayStyles}>
      <Camera className="h-8 w-8 text-white" />
    </div>
  );

  // Loading spinner overlay
  const loadingOverlay = isUploading && (
    <div className={avatarLoadingOverlayStyles}>
      <div className={spinnerStyles} />
    </div>
  );

  // Combined avatar button styles
  const avatarStyles = cn(
    avatarBaseStyles,
    canEdit && avatarEditableStyles,
    !canEdit && avatarDisabledStyles,
    isUploading && avatarUploadingStyles
  );

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={PHOTO_ACCEPT_STRING}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload photo"
      />

      {/* Avatar with conditional dropdown or direct upload */}
      <div className="relative">
        {photoUrl && canEdit ? (
          // Has photo → show dropdown menu
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isUploading}>
              <button
                type="button"
                className={avatarStyles}
                aria-label="Change or remove photo"
              >
                {avatarContent}
                {editOverlay}
                {loadingOverlay}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={openFilePicker}>
                <Upload className="h-4 w-4" />
                Change Photo
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setState("confirm-remove")}
              >
                <Trash2 className="h-4 w-4" />
                Remove Photo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // No photo → direct upload button
          <button
            type="button"
            onClick={canEdit ? openFilePicker : undefined}
            disabled={!canEdit || isUploading}
            className={avatarStyles}
            aria-label={canEdit ? "Upload photo" : "Student photo"}
          >
            {avatarContent}
            {editOverlay}
            {loadingOverlay}
          </button>
        )}
      </div>

      {/* Preview Dialog */}
      <AlertDialog open={state === "preview"} onOpenChange={() => handleCancel()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Upload Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Preview your photo before uploading. Allowed formats:{" "}
              {ALLOWED_PHOTO_EXTENSIONS.join(", ")}. Max size: {MAX_PHOTO_SIZE_DISPLAY}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {previewUrl && (
            <div className="flex justify-center py-4">
              <div className={previewContainerStyles}>
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleUpload}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Remove Dialog */}
      <AlertDialog
        open={state === "confirm-remove"}
        onOpenChange={() => setState("idle")}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this student&apos;s photo? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="danger" onClick={handleRemove}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Photo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
