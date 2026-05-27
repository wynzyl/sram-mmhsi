import { NextRequest, NextResponse, connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getAssessmentsList,
  getAssessmentTabCounts,
  getPendingAssessmentQueue,
  type AssessmentBillingFilter,
} from "@/features/assessments";

const PAGE_SIZE = 20;

const ASSESSMENT_VIEWS = [
  "pending",
  "unpaid",
  "outstanding",
  "paid",
  "cancelled",
  "forwarded",
] as const;
type AssessmentView = (typeof ASSESSMENT_VIEWS)[number];

function parseView(value: string | null): AssessmentView {
  return ASSESSMENT_VIEWS.includes(value as AssessmentView)
    ? (value as AssessmentView)
    : "pending";
}

function viewToBillingFilter(view: AssessmentView): AssessmentBillingFilter | undefined {
  switch (view) {
    case "unpaid":
    case "outstanding":
    case "paid":
    case "cancelled":
    case "forwarded":
      return view;
    default:
      return undefined;
  }
}

export async function GET(request: NextRequest) {
  await connection(); // Requires auth - exclude from prerendering
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(user.role, "assessments:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const view = parseView(searchParams.get("view"));
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

    const canCreate = hasPermission(user.role, "assessments:create");
    const canCancel = hasPermission(user.role, "enrollments:cancel");

    const [tabCounts, pending, billing] = await Promise.all([
      getAssessmentTabCounts(),
      view === "pending"
        ? getPendingAssessmentQueue({ page, pageSize: PAGE_SIZE })
        : getPendingAssessmentQueue({ page: 1, pageSize: 1 }),
      view !== "pending"
        ? getAssessmentsList({
            page,
            pageSize: PAGE_SIZE,
            billingFilter: viewToBillingFilter(view),
          })
        : null,
    ]);

    const isPending = view === "pending";
    const totalCount = isPending
      ? pending.totalCount
      : billing!.pagination.totalRecords;
    const totalPages = isPending
      ? Math.max(1, Math.ceil(pending.totalCount / PAGE_SIZE))
      : billing!.pagination.totalPages;
    const currentPage = Math.min(Math.max(1, page), totalPages || 1);

    return NextResponse.json({
      view,
      rows: isPending ? [] : billing!.data,
      pendingRows: isPending ? pending.rows : [],
      totalCount,
      totalPages,
      currentPage,
      tabCounts,
      pendingCount: pending.totalCount,
      canCreate,
      canCancel,
    });
  } catch (error) {
    console.error("Error fetching assessments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
