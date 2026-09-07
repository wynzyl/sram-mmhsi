import Link from "next/link";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { CurriculumForm } from "@/features/academics/curriculums/components/CurriculumForm";

// Instant navigation enabled - uses Suspense for streaming

/**
 * Instant navigation - form skeleton shown while session is verified.
 */
export default function NewCurriculumPage() {
  return (
    <Suspense fallback={<NewCurriculumSkeleton />}>
      <NewCurriculumContent />
    </Suspense>
  );
}

function NewCurriculumSkeleton() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Skeleton className="h-4 w-24" />
        <span>/</span>
        <Skeleton className="h-4 w-32" />
      </nav>
      <div className="mb-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 mt-2" />
      </div>
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

async function NewCurriculumContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:create")) {
    redirect("/staff/academics/curriculums");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/staff/academics/curriculums" className="hover:text-primary">
          Curriculums
        </Link>
        <span>/</span>
        <span className="text-foreground">New Curriculum</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create New Curriculum</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start with a draft curriculum. Add subjects, then publish when ready.
        </p>
      </div>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <CurriculumForm mode="create" />
      </div>
    </div>
  );
}
