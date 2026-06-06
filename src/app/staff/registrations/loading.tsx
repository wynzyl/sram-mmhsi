import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function StaffRegistrationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Registrations table */}
      <SkeletonTable rows={10} columns={6} />
    </div>
  );
}
