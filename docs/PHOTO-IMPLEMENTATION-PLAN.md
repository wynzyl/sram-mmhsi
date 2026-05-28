# Student Profile Photo Feature - Implementation Plan

## Summary

Add student profile photo upload capability to SRAMS. Registrars can upload/update photos by clicking the avatar in the edit page hero. Photos display on both profile view and edit pages.

---

## Key Decisions (from clarification)

- **Upload trigger:** Click avatar square in StudentEditHero (edit page only)
- **Photo exists:** Show options menu (Change Photo / Remove Photo)
- **Display:** Photo shown on both StudentRecordProfile AND StudentEditHero
- **Output format:** Compare WebP, PNG, JPEG - use smallest
- **Max size:** 2MB
- **Filename:** `{referenceNumber}.{ext}` (e.g., `SRAMS-2026-00001.webp`)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/students/students-photo.schema.ts` | Photo validation schemas and constants |
| `src/lib/utils/image-processor.ts` | Sharp-based image optimization utility |
| `src/app/api/students/[studentId]/photo/route.ts` | Upload (POST) and Delete (DELETE) API |
| `src/features/students/components/StudentAvatar.tsx` | Display component (photo or initials fallback) |
| `src/features/students/components/StudentPhotoUpload.tsx` | Interactive upload component with dialog |
| `public/uploads/students/.gitkeep` | Ensure upload directory exists |
| `drizzle/XXXX_add_student_photo_url.sql` | Database migration (auto-generated) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add `photoUrl` field to students table (line ~271) |
| `src/features/students/components/StudentEditHero.tsx` | Replace initials div with StudentPhotoUpload |
| `src/features/students/components/StudentRecordProfile.tsx` | Add photoUrl to type, display with StudentAvatar |
| `src/app/page-templates/students/edit-student-page.tsx` | Pass photoUrl and studentId to hero |
| `src/app/page-templates/students/student-profile-page.tsx` | Include photoUrl in query |
| `.gitignore` | Ignore uploaded photos except .gitkeep |
| `package.json` | Add sharp dependency |

---

## Implementation Phases

### Phase 1: Database Schema
1. Add `photoUrl: text("photo_url")` to students table in `schema.ts` (after `submittedDocumentsNotes`)
2. Run `npm run db:generate --name=add_student_photo_url`
3. Run `npm run db:migrate`

### Phase 2: Dependencies & Utilities
1. Install: `npm install sharp`
2. Create `src/features/students/students-photo.schema.ts`:
   - Constants: ALLOWED_TYPES, MAX_SIZE_BYTES
   - Helper functions: isValidPhotoType(), isValidPhotoSize()
   - Zod schemas for server validation

3. Create `src/lib/utils/image-processor.ts`:
   - `validateImageBuffer()` - Magic byte validation
   - `optimizeProfilePhoto()` - Resize 400x400, compare formats, pick smallest
   - `deleteExistingPhoto()` - Remove old photo with any extension

### Phase 3: API Route
Create `src/app/api/students/[studentId]/photo/route.ts`:

**POST handler:**
1. Auth via `getCurrentUser()` + `hasPermission(role, "students:update")`
2. Validate studentId (UUID format, student exists)
3. Parse FormData, get file
4. Server-side validation (magic bytes, not Content-Type)
5. Fetch student.referenceNumber for filename
6. Delete existing photo if present
7. Process with Sharp (resize 400x400, optimize format)
8. Save to `public/uploads/students/{referenceNumber}.{ext}`
9. Update DB: `students.photoUrl = /uploads/students/...`
10. Audit log via `logUpdateAction()`
11. Revalidate paths
12. Return `{ success: true, photoUrl }`

**DELETE handler:**
1. Auth + permission check
2. Get current photoUrl from DB
3. Delete file from filesystem
4. Update DB: `students.photoUrl = null`
5. Audit log
6. Return `{ success: true }`

### Phase 4: Components

**StudentAvatar.tsx** (display only):
```tsx
type Props = {
  photoUrl: string | null;
  initials: string;
  size?: "sm" | "md" | "lg";  // 48px, 112px, 128px
};
// Shows <Image> if photoUrl, else styled initials div
```

**StudentPhotoUpload.tsx** (interactive, client component):
```tsx
type Props = {
  studentId: string;
  referenceNumber: string;
  currentPhotoUrl: string | null;
  initials: string;
  canEdit: boolean;
};
```

**Behavior:**
- No photo + click: Open file picker directly
- Has photo + click: Show popover with "Change Photo" / "Remove Photo"
- File selected: Show AlertDialog with preview, file info, Cancel/Upload buttons
- Upload: Show spinner, POST to API, toast on success/error
- Remove: Confirm dialog, DELETE to API

**Uses:** AlertDialog, useFormToast, fetch API

### Phase 5: Integration

1. **StudentEditHero.tsx**:
   - Add props: `studentId`, `photoUrl`
   - Replace initials div (lines 45-50) with `<StudentPhotoUpload>`

2. **StudentRecordProfile.tsx**:
   - Add `photoUrl: string | null` to `StudentRecordStudent` type
   - Replace seal div (lines 621-624) with `<StudentAvatar>` (display only)

3. **edit-student-page.tsx**:
   - Add photoUrl to student query
   - Pass `studentId` and `photoUrl` to StudentEditHero

4. **student-profile-page.tsx**:
   - Include photoUrl in student query selection

### Phase 6: Cleanup & Testing
1. Create `public/uploads/students/.gitkeep`
2. Add to `.gitignore`:
   ```
   public/uploads/students/*
   !public/uploads/students/.gitkeep
   ```
3. Run verification tests

---

## Component Hierarchy

```
StudentEditHero (server component)
  └── StudentPhotoUpload (client component)
        ├── StudentAvatar (display)
        ├── Popover (options when photo exists)
        └── AlertDialog (preview + confirm)

StudentRecordProfile (server component)
  └── StudentAvatar (display only, no click actions)
```

---

## Security Checklist

- [x] SVG rejected (XSS risk)
- [x] Server-side MIME validation via magic bytes
- [x] File size limit enforced server-side (2MB)
- [x] Permission check: `students:update`
- [x] Filename uses referenceNumber only (no user input)
- [x] EXIF metadata stripped by Sharp
- [x] Audit logging for all changes

---

## Verification Steps

1. **Database:** `npm run db:studio` - verify `photo_url` column exists
2. **Upload:** Drag image → preview dialog appears → confirm → photo displays
3. **Change:** Click existing photo → options menu → Change → new photo replaces
4. **Remove:** Click existing photo → Remove → confirm → shows initials
5. **Formats:** Test JPEG, PNG, WebP inputs - all optimize correctly
6. **Rejection:** Test >2MB file (rejected), SVG (rejected), invalid type (rejected)
7. **Permissions:** Login as cashier → avatar not clickable
8. **Profile display:** Photo shows on profile view page (read-only)
9. **Audit:** Check audit_logs table for `students:update` entries with photoUrl changes

---

## Estimated Changes

- **New files:** 7
- **Modified files:** 7
- **New dependency:** sharp
- **Database migration:** 1 column added
