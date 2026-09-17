import { Suspense } from "react";
import { requirePortalSession } from "@/lib/auth/session";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalPage } from "@/features/portal/components";
import {
  getScheduleForStudent,
  getStudentTodaySchedule,
} from "@/features/academics/schedules/schedules.queries";
import {
  ScheduleGrid,
  DayScheduleList,
} from "@/features/academics/schedules/components";
import { DAY_OF_WEEK_LABELS } from "@/features/academics/schedules/schedules.schema";
import { Calendar } from "lucide-react";

export const metadata = {
  title: "My Schedule | Student Portal",
  description: "View your class schedule",
};

export default function PortalSchedulePage() {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <ScheduleContent />
    </Suspense>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-6 gap-2">
          {[...Array(6)].map((_, col) => (
            <div key={col} className="space-y-2">
              <Skeleton className="h-8 w-full" />
              {[...Array(6)].map((_, row) => (
                <Skeleton key={row} className="h-14 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function ScheduleContent() {
  const session = await requirePortalSession();
  const activeSchoolYear = await getActiveSchoolYear();

  if (!activeSchoolYear) {
    return (
      <PortalPage
        title="My Schedule"
        description="View your weekly class schedule"
      >
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No active school year. Schedule will be available when a school year is active.
          </p>
        </div>
      </PortalPage>
    );
  }

  // Fetch schedule data
  const [studentSchedule, todaySchedule] = await Promise.all([
    getScheduleForStudent(session.studentId, activeSchoolYear.id),
    getStudentTodaySchedule(session.studentId, activeSchoolYear.id),
  ]);

  if (!studentSchedule.section) {
    return (
      <PortalPage
        title="My Schedule"
        description="View your weekly class schedule"
      >
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            You are not enrolled in a section for this school year.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Please contact the registrar if you believe this is an error.
          </p>
        </div>
      </PortalPage>
    );
  }

  return (
    <PortalPage
      title="My Schedule"
      description={`${studentSchedule.section.gradeLevelName} - ${studentSchedule.section.name}`}
    >
      <div className="space-y-6">
        {/* Today's Classes */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today&apos;s Classes
          </h2>
          {todaySchedule.dayOfWeek ? (
            <DayScheduleList
              slots={todaySchedule.slots}
              dayOfWeek={todaySchedule.dayOfWeek}
              emptyMessage="No classes scheduled for today"
            />
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p className="font-medium">It&apos;s the weekend!</p>
              <p className="text-sm mt-1">
                See your weekly schedule below.
              </p>
            </div>
          )}
        </section>

        {/* Weekly Schedule */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="bg-muted px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Weekly Schedule
            </h2>
          </div>
          <div className="p-2">
            <ScheduleGrid
              rows={studentSchedule.rows}
              subjectOfferings={[]}
              periods={[]}
              rooms={[]}
              canManage={false}
            />
          </div>
        </section>
      </div>
    </PortalPage>
  );
}
