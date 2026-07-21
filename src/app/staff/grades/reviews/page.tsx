import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getActiveSchoolYear,
  getCoordinatorPendingReviews,
} from "@/features/academics/grades/grades.queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { GRADING_PERIOD_LABELS } from "@/lib/constants/grading-periods";

export const metadata = {
  title: "Pending Reviews | SRAMS",
  description: "Review grade sheets submitted by section advisers",
};

export default async function CoordinatorReviewsPage() {
  const session = await requireSession();

  // Only coordinators can access this page
  if (!hasPermission(session.role, "grades:coordinator_review")) {
    redirect("/staff/grades");
  }

  const activeSY = await getActiveSchoolYear();

  if (!activeSY) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          Pending Reviews
        </h1>
        <div className="p-6 bg-yellow-50 rounded-lg text-yellow-800">
          No active school year found. Please contact the administrator.
        </div>
      </div>
    );
  }

  const pendingReviews = await getCoordinatorPendingReviews(
    session.userId,
    activeSY.id
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pending Reviews
        </h1>
        <p className="text-muted-foreground">
          Grade sheets submitted for your review ({activeSY.label})
        </p>
      </div>

      {pendingReviews.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No pending reviews
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              No grade sheets are waiting for your review. Check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingReviews.map((sheet) => (
            <Link
              key={sheet.id}
              href={`/staff/grades/sheets/${sheet.id}`}
              className="block group"
            >
              <Card className="hover:shadow-md hover:border-indigo-100 transition-all h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="info" className="text-xs">
                      Submitted
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {GRADING_PERIOD_LABELS[sheet.gradingPeriod]}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {sheet.sectionName}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sheet.gradeLevelName}
                  </p>

                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Adviser:</span>
                      <span className="font-medium">{sheet.adviserName || "—"}</span>
                    </div>
                    {sheet.submittedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Submitted:</span>
                        <span className="font-medium">
                          {formatDate(sheet.submittedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-sm text-indigo-600 font-medium">
                    Review Grades
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
      )}
    </div>
  );
}
