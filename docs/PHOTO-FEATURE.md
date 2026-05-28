# Student Profile Photo Feature - Implementation Plan

## Summary

Add the ability for registrars to upload and update student profile photos with drag-drop support, confirmation dialog, and automatic image optimization using Sharp.

---

## Requirements

- Registrar can add or update a photo for a student
- Select image from file picker OR drag-drop onto image container
- Confirmation dialog before uploading (shows preview)
- Store in `public/uploads/students/` folder
- Filename: `{referenceNumber}.{ext}` (e.g., `SRAMS-2026-00001.webp`)
- Support PNG, JPEG, WebP input (SVG rejected for security)
- Auto-optimize to smallest format using Sharp library
- Max file size: 2MB
- Save photo URL path to database
- Audit logging for all photo changes

---

## Implementation Tasks

### Task 1: Database Schema Change

**File:** `src/lib/db/schema.ts`

Add `photoUrl` field to students table (after `submittedDocumentsNotes` field, around line 271):

```typescript
photoUrl: text("photo_url"),  // e.g., "/uploads/students/SRAMS-2026-00001.webp"
```

**Commands:**
```bash
npm run db:generate --name=add_student_photo_url
npm run db:migrate
```

---

### Task 2: Install Sharp Dependency

```bash
npm install sharp
npm install --save-dev @types/sharp
```

---

### Task 3: Create Validation Schema

**New file:** `src/features/students/students-photo.schema.ts`

```typescript
import { z } from "zod";

export const PHOTO_CONFIG = {
  maxSizeBytes: 2 * 1024 * 1024, // 2MB
  maxSizeMB: 2,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"] as const,
  outputSize: { width: 400, height: 400 },
} as const;

export type AllowedMimeType = (typeof PHOTO_CONFIG.allowedMimeTypes)[number];

export function isValidPhotoType(mimeType: string): mimeType is AllowedMimeType {
  return PHOTO_CONFIG.allowedMimeTypes.includes(mimeType as AllowedMimeType);
}

export function isValidPhotoSize(sizeBytes: number): boolean {
  return sizeBytes <= PHOTO_CONFIG.maxSizeBytes;
}

// Server-side validation schema
export const uploadPhotoSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
});

export type UploadPhotoInput = z.infer<typeof uploadPhotoSchema>;

export type PhotoUploadFormState = {
  success?: boolean;
  message?: string;
  errors?: { photo?: string[]; studentId?: string[] };
  photoUrl?: string;
};
```

---

### Task 4: Create Image Processing Utility

**New file:** `src/lib/utils/image-processor.ts`

```typescript
import sharp from "sharp";
import { PHOTO_CONFIG } from "@/features/students/students-photo.schema";

type OutputFormat = "webp" | "png" | "jpeg";

interface ProcessedImage {
  buffer: Buffer;
  format: OutputFormat;
  extension: string;
}

export async function optimizeProfilePhoto(
  inputBuffer: Buffer
): Promise<ProcessedImage> {
  const { width, height } = PHOTO_CONFIG.outputSize;

  // Resize and convert to all formats
  const baseImage = sharp(inputBuffer)
    .resize(width, height, { fit: "cover", position: "center" });

  const [webpBuffer, pngBuffer, jpegBuffer] = await Promise.all([
    baseImage.clone().webp({ quality: 80 }).toBuffer(),
    baseImage.clone().png({ compressionLevel: 9 }).toBuffer(),
    baseImage.clone().jpeg({ quality: 85 }).toBuffer(),
  ]);

  // Find smallest output
  const outputs: { buffer: Buffer; format: OutputFormat; extension: string }[] = [
    { buffer: webpBuffer, format: "webp", extension: ".webp" },
    { buffer: pngBuffer, format: "png", extension: ".png" },
    { buffer: jpegBuffer, format: "jpeg", extension: ".jpg" },
  ];

  outputs.sort((a, b) => a.buffer.length - b.buffer.length);
  return outputs[0];
}
```

---

### Task 5: Create API Route for Photo Upload

**New file:** `src/app/api/students/[studentId]/photo/route.ts`

Handles POST (upload) and DELETE (remove) operations:

- **POST:**
  1. Auth + permission check (`students:update`)
  2. Validate file type and size
  3. Fetch student to get reference number
  4. Process image with Sharp (resize 400x400, optimize format)
  5. Delete existing photo if present (different extension)
  6. Save to `public/uploads/students/{referenceNumber}.{ext}`
  7. Update `photoUrl` in database
  8. Audit log the change
  9. Return new photo URL

- **DELETE:**
  1. Auth + permission check
  2. Fetch student and current photo
  3. Delete file from filesystem
  4. Set `photoUrl` to null in database
  5. Audit log the removal

---

### Task 6: Create Photo Upload Component

**New file:** `src/features/students/components/StudentPhotoUpload.tsx`

Features:
- Circular photo display with initials fallback (matches current hero style)
- Drag-drop zone on the image container with visual highlight
- Click to open file picker
- Confirmation dialog (AlertDialog) before upload showing:
  - Large preview of selected image
  - File name, type, and size
  - "Cancel" and "Upload" buttons
- Loading spinner during upload
- "Change Photo" / "Remove Photo" buttons when photo exists
- Client-side validation before showing confirmation
- Uses `useFormToast` for success/error notifications

**UX Flow:**
1. User drags image onto photo area (or clicks to browse)
2. Client validates file type and size
3. Confirmation dialog appears with preview
4. On confirm, upload begins with loading indicator
5. Success toast shown, photo updates in place

---

### Task 7: Update StudentRecordProfile Component

**File:** `src/features/students/components/StudentRecordProfile.tsx`

Changes:
1. Update `StudentRecordStudent` type to include `photoUrl: string | null`
2. In hero section (around line 630), replace initials avatar with:
   - If `photoUrl` exists: Display photo in circular container
   - If no photo: Display initials fallback (current behavior)
3. Use Next.js `<Image>` component for optimization

---

### Task 8: Update EditStudentForm Component

**File:** `src/features/students/components/EditStudentForm.tsx`

Changes:
1. Update `StudentData` interface to include `photoUrl: string | null`
2. Add `StudentPhotoUpload` component as first section (before "Student Information" DataCard)
3. Photo upload is independent of form submission (separate API call)

---

### Task 9: Update Student Queries

**File:** `src/features/students/students.queries.ts`

Ensure `photoUrl` is included in:
- `fetchStudentForEdit()` query
- `fetchStudentProfile()` query (or equivalent used by StudentRecordProfile)

---

### Task 10: Create Upload Directory

Add `.gitkeep` file to ensure directory exists:

**New file:** `public/uploads/students/.gitkeep`

Contents: empty file

Add to `.gitignore`:
```
# Student photos (local uploads)
public/uploads/students/*
!public/uploads/students/.gitkeep
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/students/students-photo.schema.ts` | Validation schemas and constants |
| `src/lib/utils/image-processor.ts` | Sharp-based image optimization |
| `src/app/api/students/[studentId]/photo/route.ts` | Upload/delete API endpoints |
| `src/features/students/components/StudentPhotoUpload.tsx` | Photo upload UI component |
| `public/uploads/students/.gitkeep` | Ensure upload directory exists |
| `drizzle/XXXX_add_student_photo_url.sql` | Database migration (auto-generated) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add `photoUrl` field to students table |
| `src/features/students/components/EditStudentForm.tsx` | Add photo upload section |
| `src/features/students/components/StudentRecordProfile.tsx` | Display photo in hero |
| `src/features/students/students.queries.ts` | Include `photoUrl` in queries |
| `.gitignore` | Ignore uploaded photos except .gitkeep |
| `package.json` | Add sharp dependency |

---

## Security Considerations

1. **Permission check:** `students:update` required for upload/delete
2. **Server-side MIME validation:** Don't trust client Content-Type header
3. **SVG rejection:** No SVG files allowed (XSS risk via embedded scripts)
4. **File size limit:** 2MB enforced server-side
5. **Safe filename:** Uses reference number (known format, no user input)
6. **Audit trail:** All photo changes logged with `logUpdateAction()`
7. **No directory traversal:** Student ID validated as UUID before path construction

---

## Verification Steps

1. **Database:** Run `npm run db:studio` and verify `photo_url` column exists in students table
2. **Drag-drop:** Drag image onto photo container - verify border highlight effect
3. **Confirmation:** Verify AlertDialog appears with preview before upload
4. **Cancel:** Click cancel in confirmation - no upload should occur
5. **Upload formats:** Test uploading JPEG, PNG, WebP - all should optimize correctly
6. **Optimization:** Check saved file is smallest format (compare original vs saved size)
7. **Display:** Photo appears in student profile hero and edit form
8. **Replace:** Upload new photo when one exists - old file deleted, new saved
9. **Delete:** Click remove - file deleted, DB field nullified
10. **Permissions:** Login as cashier/teacher - upload button should not appear
11. **Audit:** Check audit_logs table for photo change entries
12. **Edge cases:** Test >2MB file (rejected), invalid type (rejected), network error (toast shown)

---

## Implementation Order

1. Task 1: Database schema + migration
2. Task 2: Install Sharp
3. Task 3: Create validation schema
4. Task 4: Create image processor utility
5. Task 5: Create API route
6. Task 10: Create upload directory + gitignore
7. Task 6: Create upload component
8. Task 9: Update queries
9. Task 7: Update StudentRecordProfile
10. Task 8: Update EditStudentForm
11. Run verification steps
