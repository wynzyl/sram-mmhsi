import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";
import {
  getScheduleForSection,
  getSectionDetails,
  getSubjectOfferingsForSection,
  getPeriodsForDropdown,
  getRoomsForDropdown,
} from "@/features/academics/schedules/queries";
import { ScheduleGrid } from "@/features/academics/schedules/components";

interface SectionSchedulePageProps {
  params: Promise<{ sectionId: string }>;
}

export async function generateMetadata({ params }: SectionSchedulePageProps) {
  const { sectionId } = await params;
  const section = await getSectionDetails(sectionId);

  if (!section) {
    return { title: "Section Not Found | SRAMS" };
  }

  return {
    title: `${section.name} Schedule | SRAMS`,
    description: `Class schedule for ${section.gradeLevelName} - ${section.name}`,
  };
}

export default function SectionSchedulePage({ params }: SectionSchedulePageProps) {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <ScheduleContent params={params} />
    </Suspense>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9" />
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4">
          <div className="grid grid-cols-6 gap-2">
            {[...Array(6)].map((_, col) => (
              <div key={col} className="space-y-2">
                <Skeleton className="h-8 w-full" />
                {[...Array(8)].map((_, row) => (
                  <Skeleton key={row} className="h-16 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

async function ScheduleContent({ params }: SectionSchedulePageProps) {
  const { sectionId } = await params;
  const session = await requireSession();

  // Check read permission (all staff can view)
  if (!hasPermission(session.role, "schedules:read")) {
    redirect("/staff/dashboard");
  }

  // Get section details
  const section = await getSectionDetails(sectionId);
  if (!section) {
    notFound();
  }

  // Check manage permission (for editing)
  const canManage = hasPermission(session.role, "schedules:manage");

  // Fetch all required data in parallel
  const [scheduleRows, subjectOfferings, periods, rooms] = await Promise.all([
    getScheduleForSection(sectionId, section.schoolYearId),
    getSubjectOfferingsForSection(sectionId, section.schoolYearId),
    getPeriodsForDropdown(section.schoolYearId),
    getRoomsForDropdown(),
  ]);

  return (
    <div className="page-container--full space-y-6">
      {/* Header */}
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
            {section.gradeLevelName} - {section.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Class Schedule for {section.schoolYearLabel}
          </p>
        </div>
      </div>

      {/* Schedule Info */}
      {subjectOfferings.length === 0 && (
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="font-medium text-warning">No subject offerings found</p>
          <p className="text-muted-foreground mt-1">
            This section has no subject offerings assigned. Please add subject
            offerings in the Section Management page first.
          </p>
        </div>
      )}

      {/* Schedule Grid */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="schedule-heading"
      >
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            Weekly Schedule
          </span>
          {canManage && (
            <span className="text-xs text-muted-foreground">
              Click on a slot to edit, or empty cell to add
            </span>
          )}
        </div>
        <div className="p-2">
          <ScheduleGrid
            rows={scheduleRows}
            subjectOfferings={subjectOfferings}
            periods={periods}
            rooms={rooms}
            canManage={canManage && subjectOfferings.length > 0}
          />
        </div>
      </section>
    </div>
  );
}
