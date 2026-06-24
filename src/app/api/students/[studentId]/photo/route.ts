/**
 * Student Photo Upload API Route
 *
 * POST: Upload or replace student profile photo
 * DELETE: Remove student profile photo
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logUpdateAction } from "@/lib/utils/audit-logger";
import {
  validateImageBuffer,
  optimizeProfilePhoto,
  deleteExistingPhoto,
  deletePhotoByUrl,
  ensureUploadDir,
  getPhotoPath,
  getPhotoUrl,
} from "@/lib/utils/image-processor";
import { MAX_PHOTO_SIZE_BYTES } from "@/features/students/students-photo.schema";

// ─── Types ─────────────────────────────────────────────────────────────────────

type RouteParams = { params: Promise<{ studentId: string }> };

type SuccessResponse = {
  success: true;
  photoUrl: string;
};

type ErrorResponse = {
  success: false;
  error: string;
};

type ApiResponse = SuccessResponse | ErrorResponse;

// ─── POST: Upload Photo ────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const { studentId } = await params;

    // 1. Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Permission check
    if (!hasPermission(user.role, "students:update")) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to update student photos" },
        { status: 403 }
      );
    }

    // 3. Validate student exists and get reference number
    const student = await db.query.students.findFirst({
      where: and(eq(students.id, studentId), isNull(students.deletedAt)),
      columns: {
        id: true,
        referenceNumber: true,
        photoUrl: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // 4. Parse form data
    let file: File;
    try {
      const formData = await request.formData();
      const fileField = formData.get("photo");

      if (!fileField || !(fileField instanceof File)) {
        return NextResponse.json(
          { success: false, error: "No photo file provided" },
          { status: 400 }
        );
      }

      file = fileField;
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse form data" },
        { status: 400 }
      );
    }

    // 5. Validate file size (pre-buffer check)
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File exceeds maximum size of 2MB" },
        { status: 400 }
      );
    }

    // 6. Get buffer and validate magic bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateImageBuffer(buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error! },
        { status: 400 }
      );
    }

    // 7. Ensure upload directory exists
    await ensureUploadDir();

    // 8. Delete existing photo if present
    await deleteExistingPhoto(student.referenceNumber);

    // 9. Optimize image - wrap with specific error handling for sharp failures
    let optimized;
    try {
      optimized = await optimizeProfilePhoto(buffer, student.referenceNumber);
    } catch (sharpError) {
      console.error("Sharp image processing failed:", sharpError);
      return NextResponse.json(
        {
          success: false,
          error:
            "Image processing failed. Please try a different image format or smaller file.",
        },
        { status: 400 }
      );
    }

    // 10. Save to filesystem
    const filePath = getPhotoPath(student.referenceNumber, optimized.extension);
    try {
      await writeFile(filePath, optimized.buffer);
    } catch (fsError) {
      console.error("Failed to save photo to filesystem:", fsError);
      return NextResponse.json(
        { success: false, error: "Failed to save photo. Storage may be unavailable." },
        { status: 500 }
      );
    }

    // 11. Update database
    const photoUrl = getPhotoUrl(student.referenceNumber, optimized.extension);
    const previousPhotoUrl = student.photoUrl;

    await db
      .update(students)
      .set({
        photoUrl,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(students.id, studentId));

    // 12. Audit log
    await logUpdateAction(
      { id: user.id, role: user.role },
      "students",
      studentId,
      { photoUrl: previousPhotoUrl },
      { photoUrl }
    );

    // 13. Revalidate paths
    revalidatePath(`/staff/students/${studentId}`);
    revalidatePath(`/staff/students/${studentId}/edit`);

    return NextResponse.json({
      success: true,
      photoUrl,
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while uploading the photo" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove Photo ──────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const { studentId } = await params;

    // 1. Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Permission check
    if (!hasPermission(user.role, "students:update")) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to update student photos" },
        { status: 403 }
      );
    }

    // 3. Validate student exists and has a photo
    const student = await db.query.students.findFirst({
      where: and(eq(students.id, studentId), isNull(students.deletedAt)),
      columns: {
        id: true,
        photoUrl: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    if (!student.photoUrl) {
      return NextResponse.json(
        { success: false, error: "Student has no photo to remove" },
        { status: 400 }
      );
    }

    // 4. Delete file from filesystem
    await deletePhotoByUrl(student.photoUrl);

    // 5. Update database
    const previousPhotoUrl = student.photoUrl;

    await db
      .update(students)
      .set({
        photoUrl: null,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(students.id, studentId));

    // 6. Audit log
    await logUpdateAction(
      { id: user.id, role: user.role },
      "students",
      studentId,
      { photoUrl: previousPhotoUrl },
      { photoUrl: null }
    );

    // 7. Revalidate paths
    revalidatePath(`/staff/students/${studentId}`);
    revalidatePath(`/staff/students/${studentId}/edit`);

    return NextResponse.json({
      success: true,
      photoUrl: "",
    });
  } catch (error) {
    console.error("Photo delete error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while removing the photo" },
      { status: 500 }
    );
  }
}
