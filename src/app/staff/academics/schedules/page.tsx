import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { Calendar, Clock, MapPin, ChevronRight } from "lucide-react";

export const metadata = {
  title: "Class Schedules | SRAMS",
  description: "Manage class schedules, periods, and room assignments",
};

export default function SchedulesPage() {
  return (
    <Suspense fallback={<SchedulesSkeleton />}>
      <SchedulesContent />
    </Suspense>
  );
}

function SchedulesSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

async function SchedulesContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:read")) {
    redirect("/staff/dashboard");
  }

  const activeSchoolYear = await getActiveSchoolYear();
  const canManagePeriods = hasPermission(session.role, "schedules:manage_periods");
  const canManageRooms = hasPermission(session.role, "schedules:manage_rooms");
  const canManageSchedules = hasPermission(session.role, "schedules:manage");
  const isTeacher = session.role === "teacher";

  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Class Schedules
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeSchoolYear
            ? `Manage schedules for ${activeSchoolYear.label}`
            : "No active school year"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* My Schedule (for teachers) */}
        {isTeacher && (
          <Link
            href="/staff/academics/schedules/my-schedule"
            className="group rounded-lg border border-border bg-card p-6 hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">My Schedule</h3>
                  <p className="text-sm text-muted-foreground">
                    View your teaching schedule
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        )}

        {/* Period Management */}
        {canManagePeriods && (
          <Link
            href="/staff/academics/schedules/periods"
            className="group rounded-lg border border-border bg-card p-6 hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-info/10 p-2">
                  <Clock className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Periods</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage time periods and bell schedules
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        )}

        {/* Room Management */}
        {canManageRooms && (
          <Link
            href="/staff/academics/schedules/rooms"
            className="group rounded-lg border border-border bg-card p-6 hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <MapPin className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Rooms</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage classrooms and venues
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        )}
      </div>

      {/* Section Schedules - for schedule managers */}
      {canManageSchedules && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-figure">
            Section Schedules
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a section from the Sections management page to view and edit its schedule.
          </p>
          <Link
            href="/staff/academics/sections"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Go to Sections
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      )}
    </div>
  );
}
