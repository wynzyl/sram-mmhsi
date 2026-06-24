/**
 * Image Processor Utility
 *
 * Server-side image processing for student profile photos.
 * Uses sharp for resizing, format optimization, and EXIF stripping.
 */

import sharp from "sharp";
import { readdir, unlink, mkdir, access, constants } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import {
  PHOTO_DIMENSIONS,
  MAX_PHOTO_SIZE_BYTES,
} from "@/features/students/students-photo.schema";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ImageFormat = "webp" | "png" | "jpeg";

export interface OptimizedImage {
  buffer: Buffer;
  format: ImageFormat;
  extension: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

// ─── Magic Bytes for Image Type Detection ──────────────────────────────────────

const MAGIC_BYTES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: {
    riff: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    webp: [0x57, 0x45, 0x42, 0x50], // "WEBP" at offset 8
  },
} as const;

// ─── Upload Directory ──────────────────────────────────────────────────────────

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "students");

/**
 * Ensure the upload directory exists.
 */
export async function ensureUploadDir(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  // Verify we can write to the directory
  try {
    await access(UPLOAD_DIR, constants.W_OK);
  } catch {
    throw new Error(`Upload directory is not writable: ${UPLOAD_DIR}`);
  }
}

/**
 * Get the full filesystem path for a student photo.
 */
export function getPhotoPath(
  referenceNumber: string,
  extension: string
): string {
  return join(UPLOAD_DIR, `${referenceNumber}.${extension}`);
}

/**
 * Get the public URL path for a student photo.
 */
export function getPhotoUrl(
  referenceNumber: string,
  extension: string
): string {
  return `/uploads/students/${referenceNumber}.${extension}`;
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate image buffer using magic byte detection.
 * Rejects SVG and other non-raster formats that could contain XSS.
 */
export function validateImageBuffer(buffer: Buffer): ImageValidationResult {
  if (buffer.length < 12) {
    return { valid: false, error: "File too small to be a valid image" };
  }

  if (buffer.length > MAX_PHOTO_SIZE_BYTES) {
    return { valid: false, error: "File exceeds maximum size of 2MB" };
  }

  // Check JPEG magic bytes
  const isJpeg =
    buffer[0] === MAGIC_BYTES.jpeg[0] &&
    buffer[1] === MAGIC_BYTES.jpeg[1] &&
    buffer[2] === MAGIC_BYTES.jpeg[2];

  // Check PNG magic bytes
  const isPng =
    buffer[0] === MAGIC_BYTES.png[0] &&
    buffer[1] === MAGIC_BYTES.png[1] &&
    buffer[2] === MAGIC_BYTES.png[2] &&
    buffer[3] === MAGIC_BYTES.png[3];

  // Check WebP magic bytes (RIFF....WEBP)
  const isWebp =
    buffer[0] === MAGIC_BYTES.webp.riff[0] &&
    buffer[1] === MAGIC_BYTES.webp.riff[1] &&
    buffer[2] === MAGIC_BYTES.webp.riff[2] &&
    buffer[3] === MAGIC_BYTES.webp.riff[3] &&
    buffer[8] === MAGIC_BYTES.webp.webp[0] &&
    buffer[9] === MAGIC_BYTES.webp.webp[1] &&
    buffer[10] === MAGIC_BYTES.webp.webp[2] &&
    buffer[11] === MAGIC_BYTES.webp.webp[3];

  if (!isJpeg && !isPng && !isWebp) {
    return {
      valid: false,
      error: "Invalid image format. Only JPEG, PNG, and WebP are allowed",
    };
  }

  return { valid: true };
}

// ─── Image Optimization ────────────────────────────────────────────────────────

/**
 * Optimize a profile photo by resizing and selecting the best format.
 *
 * - Resizes to 400x400 (cover fit, centered)
 * - Strips EXIF metadata
 * - Compares WebP, PNG, and JPEG output sizes
 * - Returns the smallest valid result
 */
export async function optimizeProfilePhoto(
  buffer: Buffer,
  referenceNumber: string
): Promise<OptimizedImage> {
  // Base pipeline: resize, remove metadata
  const base = sharp(buffer)
    .resize(PHOTO_DIMENSIONS.width, PHOTO_DIMENSIONS.height, {
      fit: "cover",
      position: "centre",
    })
    .rotate(); // Auto-rotate based on EXIF, then strip metadata

  // Generate all formats in parallel
  const [webpBuffer, pngBuffer, jpegBuffer] = await Promise.all([
    base.clone().webp({ quality: 85 }).toBuffer(),
    base.clone().png({ compressionLevel: 9 }).toBuffer(),
    base.clone().jpeg({ quality: 85, mozjpeg: true }).toBuffer(),
  ]);

  // Find smallest output
  const candidates: { buffer: Buffer; format: ImageFormat }[] = [
    { buffer: webpBuffer, format: "webp" },
    { buffer: pngBuffer, format: "png" },
    { buffer: jpegBuffer, format: "jpeg" },
  ];

  candidates.sort((a, b) => a.buffer.length - b.buffer.length);
  const best = candidates[0];

  const formatInfo: Record<
    ImageFormat,
    { extension: string; mimeType: string }
  > = {
    webp: { extension: "webp", mimeType: "image/webp" },
    png: { extension: "png", mimeType: "image/png" },
    jpeg: { extension: "jpg", mimeType: "image/jpeg" },
  };

  const info = formatInfo[best.format];

  return {
    buffer: best.buffer,
    format: best.format,
    extension: info.extension,
    mimeType: info.mimeType,
    sizeBytes: best.buffer.length,
  };
}

// ─── File Management ───────────────────────────────────────────────────────────

/**
 * Delete existing photo files for a student.
 * Removes all files matching the reference number with any extension.
 */
export async function deleteExistingPhoto(
  referenceNumber: string
): Promise<void> {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      return;
    }

    const files = await readdir(UPLOAD_DIR);
    const studentPhotoPattern = new RegExp(
      `^${escapeRegExp(referenceNumber)}\\.(webp|png|jpg|jpeg)$`,
      "i"
    );

    const deletePromises = files
      .filter((file) => studentPhotoPattern.test(file))
      .map((file) => unlink(join(UPLOAD_DIR, file)));

    await Promise.all(deletePromises);
  } catch (error) {
    // Directory might not exist yet, which is fine
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Delete a photo file by its URL path.
 */
export async function deletePhotoByUrl(photoUrl: string): Promise<void> {
  // Extract filename from URL like /uploads/students/0000001.webp
  const match = photoUrl.match(/\/uploads\/students\/(.+)$/);
  if (!match) {
    return;
  }

  const filename = match[1];
  const filePath = join(UPLOAD_DIR, filename);

  try {
    await unlink(filePath);
  } catch (error) {
    // File might not exist, which is fine
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
