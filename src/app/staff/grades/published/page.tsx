import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getActiveSchoolYear,
  getPublishedSheets,
} from "@/features/academics/grades/grades.queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { GRADING_PERIOD_LABELS } from "@/lib/constants/grading-periods";

export const metadata = {
  title: "Published Grades | SRAMS",
  description: "Published grade sheets ready to be locked",
};

export default async function PublishedGradesPage() {
  const session = await requireSession();

  // Only users with lock permission can access
  if (!hasPermission(session.role, "grades:lock")) {
    redirect("/staff/grades");
  }

  const activeSY = await getActiveSchoolYear();

  if (!activeSY) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4 text-foreground">
          Published Grades
        </h1>
        <div className="p-6 bg-warning-tint rounded-lg text-warning">
          No active school year found. Please contact the administrator.
        </div>
      </div>
    );
  }

  const publishedSheets = await getPublishedSheets(activeSY.id);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Published Grades
        </h1>
        <p className="text-muted-foreground">
          Grade sheets published to the student portal, ready to be locked ({activeSY.label})
        </p>
      </div>

      {publishedSheets.length === 0 ? (
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
              No published sheets
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Published grade sheets will appear here for locking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {publishedSheets.map((sheet) => (
            <Link
              key={sheet.id}
              href={`/staff/grades/sheets/${sheet.id}`}
              className="block group"
            >
              <Card className="hover:shadow-md hover:border-info/30 transition-all h-full border-info/25">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="info" className="text-xs">
                      Published
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {GRADING_PERIOD_LABELS[sheet.gradingPeriod]}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-foreground group-hover:text-info transition-colors">
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
                    {sheet.publishedAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Published:</span>
                        <span className="font-medium text-foreground">
                          {formatDate(sheet.publishedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-border flex items-center text-xs text-info font-medium">
                    Lock Grades
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
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
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
