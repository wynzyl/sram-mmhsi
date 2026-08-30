import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getActiveSchoolYear,
  getReadyToPublishSheets,
} from "@/features/academics/grades/grades.queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { GRADING_PERIOD_LABELS } from "@/lib/constants/grading-periods";

export const metadata = {
  title: "Ready to Publish | SRAMS",
  description: "Approved grade sheets ready to publish to the student portal",
};

export default async function ReadyToPublishPage() {
  const session = await requireSession();

  // Only users with publish permission can access
  if (!hasPermission(session.role, "grades:publish")) {
    redirect("/staff/grades");
  }

  const activeSY = await getActiveSchoolYear();

  if (!activeSY) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4 text-foreground">
          Ready to Publish
        </h1>
        <div className="p-6 bg-warning-tint rounded-lg text-warning">
          No active school year found. Please contact the administrator.
        </div>
      </div>
    );
  }

  const readyToPublish = await getReadyToPublishSheets(activeSY.id);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Ready to Publish
        </h1>
        <p className="text-muted-foreground">
          Approved grade sheets ready to publish to the student portal ({activeSY.label})
        </p>
      </div>

      {readyToPublish.length === 0 ? (
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
              No sheets ready to publish
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved grade sheets will appear here for publishing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {readyToPublish.map((sheet) => (
            <Link
              key={sheet.id}
              href={`/staff/grades/sheets/${sheet.id}`}
              className="block group"
            >
              <Card className="hover:shadow-md hover:border-success/30 transition-all h-full border-success/25">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="success" className="text-xs">
                      Approved
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {GRADING_PERIOD_LABELS[sheet.gradingPeriod]}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-foreground group-hover:text-success transition-colors">
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
                    {sheet.principalApprovedAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Approved:</span>
                        <span className="font-medium text-foreground">
                          {formatDate(sheet.principalApprovedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-border flex items-center text-xs text-success font-medium">
                    Publish to Portal
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
      )}
    </div>
  );
}
