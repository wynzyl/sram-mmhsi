import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllStrands } from "@/features/academics/strands/strands.queries";
import { StrandsTable } from "@/features/academics/strands";
import { AddStrandButton } from "./AddStrandButton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata = {
  title: "Strands Management | SRAMS",
  description: "Manage SHS academic strands",
};

/**
 * Instant navigation - full strands page skeleton shown while data loads.
 */
export default function StrandsPage() {
  return (
    <Suspense fallback={<StrandsSkeleton />}>
      <StrandsContent />
    </Suspense>
  );
}

function StrandsSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-72" />
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function StrandsContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "strands:read")) {
    redirect("/staff/dashboard");
  }

  const strands = await getAllStrands();
  const canManage = hasPermission(session.role, "strands:manage");

  const activeStrands = strands.filter((s) => s.isActive);
  const academicStrands = strands.filter((s) => !s.code.startsWith("TVL-"));
  const tvlStrands = strands.filter((s) => s.code.startsWith("TVL-"));

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          SHS Strands
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage Senior High School academic strands and specializations
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="strands-heading"
      >
        {/* Card Header with gradient effect */}
        <div className="bg-muted flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + Stats Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              id="strands-heading"
              className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
            >
              Strand List
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {strands.length} Total
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
              {activeStrands.length} Active
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info/10 text-info border border-info/30">
              {academicStrands.length} Academic
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/30">
              {tvlStrands.length} TVL
            </span>
          </div>

          {/* Right: Controls (single row, no wrapping) */}
          <div className="filter-controls-inline">
            {canManage && <AddStrandButton />}
          </div>
        </div>

        {/* Table Content */}
        <StrandsTable strands={strands} canManage={canManage} />
      </section>
    </div>
  );
}
