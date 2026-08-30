import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { listCurriculums } from "@/features/academics/curriculums";
import { CurriculumsListTable } from "@/features/academics/curriculums/components/CurriculumsListTable";

export default async function CurriculumsPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:read")) {
    redirect("/staff/dashboard");
  }

  const curriculums = await listCurriculums();
  const canCreate = hasPermission(session.role, "curriculums:create");

  const publishedCount = curriculums.filter((c) => c.status === "published").length;
  const draftCount = curriculums.filter((c) => c.status === "draft").length;
  const archivedCount = curriculums.filter((c) => c.status === "archived").length;

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Curriculums
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage curriculum versions and subject definitions
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="curriculum-heading"
      >
        {/* Card Header with gradient effect */}
        <div className="bg-muted flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + Stats Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              id="curriculum-heading"
              className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
            >
              Curriculum List
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {curriculums.length} Total
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
              {publishedCount} Published
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/30">
              {draftCount} Draft{draftCount !== 1 ? "s" : ""}
            </span>
            {archivedCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                {archivedCount} Archived
              </span>
            )}
          </div>

          {/* Right: Controls (single row, no wrapping) */}
          <div className="filter-controls-inline">
            {canCreate && (
              <Link
                href="/staff/academics/curriculums/new"
                className="btn-gradient-primary inline-flex items-center justify-center min-h-10 px-4 rounded-md whitespace-nowrap"
              >
                + New Curriculum
              </Link>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="p-4">
          <CurriculumsListTable data={curriculums} />
        </div>
      </section>
    </div>
  );
}

