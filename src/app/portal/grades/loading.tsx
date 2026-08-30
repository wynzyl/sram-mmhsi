import { SkeletonTable } from "@/components/ui/skeleton";
import {
  PortalPageSkeleton,
  PortalSectionSkeleton,
} from "@/features/portal/components/PortalPageSkeleton";

export default function PortalGradesLoading() {
  return (
    <PortalPageSkeleton>
      <PortalSectionSkeleton footer>
        <SkeletonTable rows={4} columns={6} />
      </PortalSectionSkeleton>
    </PortalPageSkeleton>
  );
}
