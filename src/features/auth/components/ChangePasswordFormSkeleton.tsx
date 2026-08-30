import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for the change-password card body (form + footer link).
 *
 * Shared by the staff and portal change-password pages: both render their
 * session-aware content inside a Suspense boundary (session access is
 * uncached under cacheComponents), so both need the same fallback.
 */
export function ChangePasswordFormSkeleton() {
  return (
    <div className="flex flex-col gap-[1.125rem]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="mt-1 h-11 w-full rounded-md" />
      <Skeleton className="mx-auto mt-4 h-3 w-32" />
    </div>
  );
}
