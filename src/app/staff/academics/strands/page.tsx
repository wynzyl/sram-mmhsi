import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getAllStrands } from "@/features/academics/strands/strands.queries";
import { StrandsTable } from "@/features/academics/strands";
import { AddStrandButton } from "./AddStrandButton";

export const metadata = {
  title: "Strands Management | SRAMS",
  description: "Manage SHS academic strands",
};

export default async function StrandsPage() {
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              {academicStrands.length} Academic
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30">
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
