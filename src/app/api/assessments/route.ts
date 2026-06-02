import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getAssessmentsList,
  getAssessmentTabCounts,
  getPendingAssessmentQueue,
  type AssessmentBillingFilter,
} from "@/features/assessments";
import { withAuth, jsonResponse, parseIntParam } from "@/lib/api/route-helpers";

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

export const GET = withAuth(
  { permission: "assessments:read" },
  async (request: NextRequest, user) => {
    const searchParams = request.nextUrl.searchParams;
    const view = parseView(searchParams.get("view"));
    const page = parseIntParam(searchParams.get("page"), 1, { min: 1 });

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

    return jsonResponse({
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
  }
);
