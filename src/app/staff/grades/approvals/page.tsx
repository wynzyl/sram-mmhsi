import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getActiveSchoolYear,
  getPrincipalPendingReviews,
} from "@/features/academics/grades/grades.queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { GRADING_PERIOD_LABELS } from "@/lib/constants/grading-periods";
import { PaginationControls } from "@/components/shared/PaginationControls";

export const metadata = {
  title: "Pending Approvals | SRAMS",
  description: "Review and approve grade sheets submitted by section advisers",
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function GradeApprovalsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const session = await requireSession();

  // Only principals can access this page
  if (!hasPermission(session.role, "grades:principal_review")) {
    redirect("/staff/grades");
  }

  const activeSY = await getActiveSchoolYear();

  if (!activeSY) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4 text-foreground">
          Pending Approvals
        </h1>
        <div className="p-6 bg-warning-tint rounded-lg text-warning">
          No active school year found. Please contact the administrator.
        </div>
      </div>
    );
  }

  const PAGE_SIZE = 20;
  const result = await getPrincipalPendingReviews(activeSY.id, {
    page,
    pageSize: PAGE_SIZE,
  });

  const { data: pendingReviews, pagination } = Array.isArray(result)
    ? { data: result, pagination: null }
    : result;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Pending Approvals
        </h1>
        <p className="text-muted-foreground">
          Grade sheets awaiting your review and approval ({activeSY.label})
        </p>
      </div>

      {pendingReviews.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-foreground">
              No pending approvals
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              All grade sheets have been reviewed. Check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {pendingReviews.map((sheet) => (
              <Link
                key={sheet.id}
                href={`/staff/grades/sheets/${sheet.id}`}
                className="block group"
              >
                <Card className="hover:shadow-md hover:border-primary/30 transition-all h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="info" className="text-xs">
                        Submitted
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {GRADING_PERIOD_LABELS[sheet.gradingPeriod]}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {sheet.gradeLevelName}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Section {sheet.sectionName}
                    </p>

                    <div className="mt-3 pt-2 border-t border-border space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Adviser:</span>
                        <span className="font-medium text-foreground truncate ml-2">{sheet.adviserName || "—"}</span>
                      </div>
                      {sheet.submittedAt && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Submitted:</span>
                          <span className="font-medium text-foreground">
                            {formatDate(sheet.submittedAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-border flex items-center text-xs text-primary font-medium">
                      Review & Approve
                      <svg
                        className="ml-1 h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {pagination && (
            <PaginationControls
              pagination={pagination}
              basePath="/staff/grades/approvals"
            />
          )}
        </>
      )}
    </div>
  );
}
