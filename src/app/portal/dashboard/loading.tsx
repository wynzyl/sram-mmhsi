import { Skeleton } from "@/components/ui/skeleton";
import {
  PortalPageSkeleton,
  PortalSectionSkeleton,
} from "@/features/portal/components/PortalPageSkeleton";

export default function PortalDashboardLoading() {
  return (
    <PortalPageSkeleton>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PortalSectionSkeleton footer>
          <Skeleton className="h-10 w-48" />
        </PortalSectionSkeleton>
        <PortalSectionSkeleton footer>
          <Skeleton className="h-10 w-32" />
        </PortalSectionSkeleton>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
      </div>
    </PortalPageSkeleton>
  );
}
