import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  fetchStudentDirectoryPage,
  getStudentDirectoryEmptyMessage,
} from "@/features/students/students.queries";
import { isStudentSortBy } from "@/lib/utils/student-directory-href";

export async function GET(request: NextRequest) {
  await connection(); // Requires auth - exclude from prerendering
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "students:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const schoolYearId = searchParams.get("schoolYearId") ?? undefined;
    const gradeLevelId = searchParams.get("gradeLevelId") ?? undefined;

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validSchoolYearId =
      schoolYearId && uuidRegex.test(schoolYearId) ? schoolYearId : undefined;
    const validGradeLevelId =
      gradeLevelId && uuidRegex.test(gradeLevelId) ? gradeLevelId : undefined;

    // Sort (whitelist-validated; invalid falls back to default order)
    const rawSortBy = searchParams.get("sortBy");
    const sortBy = isStudentSortBy(rawSortBy) ? rawSortBy : undefined;
    const sortDir = sortBy
      ? searchParams.get("sortDir") === "desc"
        ? "desc"
        : "asc"
      : undefined;

    const data = await fetchStudentDirectoryPage({
      q,
      page,
      schoolYearId: validSchoolYearId,
      gradeLevelId: validGradeLevelId,
      sortBy,
      sortDir,
    });

    const emptyMessage = getStudentDirectoryEmptyMessage(
      q,
      validSchoolYearId,
      validGradeLevelId
    );

    const canCreate = hasPermission(user.role, "students:create");

    return NextResponse.json({
      ...data,
      emptyMessage,
      canCreate,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
