import { Skeleton } from "@/components/ui/skeleton";

export default function CloneCurriculumLoading() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-2" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-2" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 mt-1" />
      </div>

      {/* Source Curriculum Info */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6">
        <Skeleton className="h-4 w-32 mb-2" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-5 w-10" />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        {/* Name field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        {/* Grade Level Summary */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-full rounded" />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>
    </div>
  );
}
