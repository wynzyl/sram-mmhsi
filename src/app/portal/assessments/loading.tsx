import { Skeleton } from "@/components/ui/skeleton";
import {
  PortalPageSkeleton,
  PortalSectionSkeleton,
} from "@/features/portal/components/PortalPageSkeleton";

export default function PortalAssessmentsLoading() {
  return (
    <PortalPageSkeleton>
      <PortalSectionSkeleton>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
          </div>
        </div>
      </PortalSectionSkeleton>
    </PortalPageSkeleton>
  );
}
