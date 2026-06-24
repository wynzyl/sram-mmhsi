/**
 * Student Photo Validation Schema
 *
 * Constants and validation helpers for student profile photo uploads.
 * Used by both client-side pre-validation and server-side validation.
 */

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Allowed MIME types for photo uploads */
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedPhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];

/** Human-readable file extensions for UI display */
export const ALLOWED_PHOTO_EXTENSIONS = ["JPEG", "PNG", "WebP"] as const;

/** Maximum file size in bytes (2MB) */
export const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

/** Human-readable max size for UI display */
export const MAX_PHOTO_SIZE_DISPLAY = "2MB";

/** Target dimensions for optimized photos */
export const PHOTO_DIMENSIONS = {
  width: 400,
  height: 400,
} as const;

/** Accept string for file input */
export const PHOTO_ACCEPT_STRING = ALLOWED_PHOTO_TYPES.join(",");

// ─── Validation Helpers ────────────────────────────────────────────────────────

/**
 * Check if a MIME type is valid for photo upload.
 * Use for client-side pre-validation before upload.
 */
export function isValidPhotoType(mimeType: string): mimeType is AllowedPhotoType {
  return ALLOWED_PHOTO_TYPES.includes(mimeType as AllowedPhotoType);
}

/**
 * Check if a file size is within the allowed limit.
 * Use for client-side pre-validation before upload.
 */
export function isValidPhotoSize(sizeInBytes: number): boolean {
  return sizeInBytes > 0 && sizeInBytes <= MAX_PHOTO_SIZE_BYTES;
}

/**
 * Get a human-readable error message for photo validation failures.
 */
export function getPhotoValidationError(file: File): string | null {
  if (!isValidPhotoType(file.type)) {
    return `Invalid file type. Allowed types: ${ALLOWED_PHOTO_EXTENSIONS.join(", ")}`;
  }

  if (!isValidPhotoSize(file.size)) {
    return `File too large. Maximum size: ${MAX_PHOTO_SIZE_DISPLAY}`;
  }

  return null;
}
