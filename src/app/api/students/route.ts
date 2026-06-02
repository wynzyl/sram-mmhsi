import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  fetchStudentDirectoryPage,
  getStudentDirectoryEmptyMessage,
} from "@/features/students/students.queries";
import { isStudentSortBy } from "@/lib/utils/student-directory-href";
import {
  withAuth,
  jsonResponse,
  validateUuid,
  parseIntParam,
} from "@/lib/api/route-helpers";

export const GET = withAuth(
  { permission: "students:read" },
  async (request: NextRequest, user) => {
    const searchParams = request.nextUrl.searchParams;

    // Parse and validate parameters
    const q = searchParams.get("q") ?? "";
    const page = parseIntParam(searchParams.get("page"), 1, { min: 1 });
    const validSchoolYearId = validateUuid(searchParams.get("schoolYearId"));
    const validGradeLevelId = validateUuid(searchParams.get("gradeLevelId"));

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

    return jsonResponse({
      ...data,
      emptyMessage,
      canCreate,
    });
  }
);
