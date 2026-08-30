import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";
import {
  PortalPageSkeleton,
  PortalSectionSkeleton,
} from "@/features/portal/components/PortalPageSkeleton";

export default function PortalPaymentsLoading() {
  return (
    <PortalPageSkeleton>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
      </div>
      <PortalSectionSkeleton>
        <SkeletonTable rows={5} columns={6} />
      </PortalSectionSkeleton>
    </PortalPageSkeleton>
  );
}
