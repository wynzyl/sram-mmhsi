import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getActiveSchoolYear,
  getPrincipalPendingReviews,
  getReadyToPublishSheets,
} from "@/features/academics/grades/grades.queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { GRADING_PERIOD_LABELS } from "@/lib/constants/grading-periods";
import { PaginationControls } from "@/components/shared/PaginationControls";

export const metadata = {
  title: "Grade Management | SRAMS",
  description: "Review, approve, and publish grade sheets",
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
          Grade Management
        </h1>
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-800 dark:text-yellow-300">
          No active school year found. Please contact the administrator.
        </div>
      </div>
    );
  }

  // Fetch both pending approvals and ready to publish sheets
  const PAGE_SIZE = 12;
  const [pendingResult, readyToPublish] = await Promise.all([
    getPrincipalPendingReviews(activeSY.id, { page, pageSize: PAGE_SIZE }),
    getReadyToPublishSheets(activeSY.id),
  ]);

  const { data: pendingReviews, pagination } = Array.isArray(pendingResult)
    ? { data: pendingResult, pagination: null }
    : pendingResult;

  const canPublish = hasPermission(session.role, "grades:publish");

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Grade Management
        </h1>
        <p className="text-muted-foreground">
          Review, approve, and publish grade sheets ({activeSY.label})
        </p>
      </div>

      {/* Ready to Publish Section */}
      {canPublish && readyToPublish.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Ready to Publish</h2>
            <Badge variant="success">{readyToPublish.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {readyToPublish.map((sheet) => (
              <Link
                key={sheet.id}
                href={`/staff/grades/sheets/${sheet.id}`}
                className="block group"
              >
                <Card className="hover:shadow-md hover:border-green-500/30 transition-all h-full border-green-200 dark:border-green-800">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="success" className="text-xs">
                        Approved
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {GRADING_PERIOD_LABELS[sheet.gradingPeriod]}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                      {sheet.gradeLevelName}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Section {sheet.sectionName}
                    </p>

                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Adviser:</span>
                        <span className="font-medium text-foreground">{sheet.adviserName || "—"}</span>
                      </div>
                      {sheet.principalApprovedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Approved:</span>
                          <span className="font-medium text-foreground">
                            {formatDate(sheet.principalApprovedAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-border flex items-center text-sm text-green-600 dark:text-green-400 font-medium">
                      Publish to Portal
                      <svg
                        className="ml-1.5 h-4 w-4"
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
        </section>
      )}

      {/* Pending Approvals Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Pending Approvals</h2>
          {pendingReviews.length > 0 && (
            <Badge variant="info">{pendingReviews.length}</Badge>
          )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingReviews.map((sheet) => (
                <Link
                  key={sheet.id}
                  href={`/staff/grades/sheets/${sheet.id}`}
                  className="block group"
                >
                  <Card className="hover:shadow-md hover:border-primary/30 transition-all h-full">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="info" className="text-xs">
                          Submitted
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {GRADING_PERIOD_LABELS[sheet.gradingPeriod]}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {sheet.gradeLevelName}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Section {sheet.sectionName}
                      </p>

                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Adviser:</span>
                          <span className="font-medium text-foreground">{sheet.adviserName || "—"}</span>
                        </div>
                        {sheet.submittedAt && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Submitted:</span>
                            <span className="font-medium text-foreground">
                              {formatDate(sheet.submittedAt)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-border flex items-center text-sm text-primary font-medium">
                        Review & Approve
                        <svg
                          className="ml-1.5 h-4 w-4"
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

            {/* Pagination controls */}
            {pagination && (
              <PaginationControls
                pagination={pagination}
                basePath="/staff/grades/approvals"
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
