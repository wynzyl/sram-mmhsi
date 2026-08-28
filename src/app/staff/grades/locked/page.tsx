import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getActiveSchoolYear,
  getLockedSheets,
} from "@/features/academics/grades/grades.queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { GRADING_PERIOD_LABELS } from "@/lib/constants/grading-periods";

export const metadata = {
  title: "Locked Grades | SRAMS",
  description: "Locked grade sheets (immutable)",
};

export default async function LockedGradesPage() {
  const session = await requireSession();

  // Only users with unlock permission can access this page to manage locked sheets
  // Or users with lock permission can view (but not unlock)
  if (!hasPermission(session.role, "grades:lock") && !hasPermission(session.role, "grades:unlock")) {
    redirect("/staff/grades");
  }

  const canUnlock = hasPermission(session.role, "grades:unlock");
  const activeSY = await getActiveSchoolYear();

  if (!activeSY) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4 text-foreground">
          Locked Grades
        </h1>
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-800 dark:text-yellow-300">
          No active school year found. Please contact the administrator.
        </div>
      </div>
    );
  }

  const lockedSheets = await getLockedSheets(activeSY.id);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Locked Grades
        </h1>
        <p className="text-muted-foreground">
          Grade sheets that have been locked and are immutable ({activeSY.label})
          {canUnlock && " — You can unlock sheets if needed"}
        </p>
      </div>

      {lockedSheets.length === 0 ? (
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-foreground">
              No locked sheets
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Locked grade sheets will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {lockedSheets.map((sheet) => (
            <Link
              key={sheet.id}
              href={`/staff/grades/sheets/${sheet.id}`}
              className="block group"
            >
              <Card className="hover:shadow-md hover:border-gray-500/30 transition-all h-full border-gray-300 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">
                      Locked
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
                    {sheet.lockedAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Locked:</span>
                        <span className="font-medium text-foreground">
                          {formatDate(sheet.lockedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {canUnlock && (
                    <div className="mt-3 pt-2 border-t border-border flex items-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Unlock for Editing
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
                          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}

                  {!canUnlock && (
                    <div className="mt-3 pt-2 border-t border-border flex items-center text-xs text-muted-foreground font-medium">
                      View Details
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
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
