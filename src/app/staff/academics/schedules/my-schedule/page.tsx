import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import {
  getScheduleForTeacher,
  getTeacherDaySchedule,
  getTodayDayOfWeek,
} from "@/features/academics/schedules/schedules.queries";
import {
  ScheduleGrid,
  DayScheduleList,
} from "@/features/academics/schedules/components";
import { DAY_OF_WEEK_LABELS } from "@/features/academics/schedules/schedules.schema";
import { ChevronLeft, Calendar } from "lucide-react";

export const metadata = {
  title: "My Schedule | SRAMS",
  description: "View your teaching schedule",
};

export default function MySchedulePage() {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <ScheduleContent />
    </Suspense>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-5 w-16" />
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
        <div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

async function ScheduleContent() {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "schedules:read")) {
    redirect("/staff/dashboard");
  }

  const activeSchoolYear = await getActiveSchoolYear();

  if (!activeSchoolYear) {
    return (
      <div className="page-container--full space-y-6">
        <Header />
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No active school year. Schedule will be available when a school year is active.
          </p>
        </div>
      </div>
    );
  }

  const today = getTodayDayOfWeek();

  // Fetch schedule data in parallel
  const [scheduleRows, todaySlots] = await Promise.all([
    getScheduleForTeacher(session.userId, activeSchoolYear.id),
    today
      ? getTeacherDaySchedule(session.userId, activeSchoolYear.id, today)
      : Promise.resolve([]),
  ]);

  // Count total classes
  const totalClasses = scheduleRows.reduce((sum, row) => {
    return (
      sum +
      (row.monday ? 1 : 0) +
      (row.tuesday ? 1 : 0) +
      (row.wednesday ? 1 : 0) +
      (row.thursday ? 1 : 0) +
      (row.friday ? 1 : 0)
    );
  }, 0);

  return (
    <div className="page-container--full space-y-6">
      <Header schoolYearLabel={activeSchoolYear.label} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Schedule Grid */}
        <section className="lg:col-span-2 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Weekly Schedule
            </span>
            <span className="text-xs text-muted-foreground">
              {totalClasses} class{totalClasses !== 1 ? "es" : ""} per week
            </span>
          </div>
          <div className="p-2">
            {totalClasses > 0 ? (
              <ScheduleGrid
                rows={scheduleRows}
                subjectOfferings={[]}
                periods={[]}
                rooms={[]}
                canManage={false}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No classes scheduled</p>
                <p className="text-sm mt-1">
                  You don&apos;t have any classes assigned for this school year yet.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Today's Classes */}
        <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <div className="bg-muted border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {today ? `Today (${DAY_OF_WEEK_LABELS[today]})` : "Today"}
            </span>
          </div>
          <div className="p-4">
            {today ? (
              <DayScheduleList
                slots={todaySlots}
                dayOfWeek={today}
                showSection
                emptyMessage="No classes scheduled for today"
              />
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="font-medium">It&apos;s the weekend!</p>
                <p className="text-sm mt-1">Enjoy your day off.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Header({ schoolYearLabel }: { schoolYearLabel?: string }) {
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/staff/academics/schedules"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-figure">
          My Teaching Schedule
        </h1>
        {schoolYearLabel && (
          <p className="text-sm text-muted-foreground">{schoolYearLabel}</p>
        )}
      </div>
    </div>
  );
}
