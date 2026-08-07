/**
 * Cleanup Orphaned SSE Records
 *
 * POST /api/admin/cleanup-sse
 *
 * Finds and soft-deletes studentSubjectEnrollments where the parent
 * subject offering was deleted but the SSE was not cleaned up.
 *
 * Requires: subject_offerings:generate permission
 */

import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { cleanupOrphanedSSEAction } from "@/features/academics/subject-offerings";

export async function POST() {
  await connection();

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "subject_offerings:generate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await cleanupOrphanedSSEAction();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cleanup SSE error:", error);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
