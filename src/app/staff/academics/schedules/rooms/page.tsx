import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllRooms } from "@/features/academics/schedules/queries";
import { RoomsTable } from "@/features/academics/schedules/components/RoomsTable";

export const metadata = {
  title: "Room Management | SRAMS",
  description: "Manage classrooms and venues for class scheduling",
};

export default function RoomsPage() {
  return (
    <Suspense fallback={<RoomsSkeleton />}>
      <RoomsContent />
    </Suspense>
  );
}

function RoomsSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function RoomsContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_rooms")) {
    redirect("/staff/dashboard");
  }

  const rooms = await getAllRooms();

  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Room Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage classrooms and venues for class scheduling
        </p>
      </div>

      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="rooms-heading"
      >
        <RoomsTable rooms={rooms} />
      </section>
    </div>
  );
}
