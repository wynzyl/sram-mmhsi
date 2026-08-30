import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import { getAllFeeTemplates } from "@/features/finance/fee-templates/fee-templates.queries";
import { TemplateAssignmentForm } from "@/features/finance/fee-templates/components/TemplateAssignmentForm";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Assign Fee Template | SRAMS",
  description: "Assign a fee template to a school year and assessment band",
};

export default async function NewFeeSchedulePage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

  const templates = await getAllFeeTemplates();
  const activeTemplates = templates.filter((t) => t.isActive);

  const allSchoolYears = await db.query.schoolYears.findMany({
    where: isNull(schoolYears.deletedAt),
    orderBy: [desc(schoolYears.startDate)],
  });

  return (
    <div className="px-8 py-6 max-w-[800px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-4" aria-label="Breadcrumb">
        <Link href="/staff/finance/fee-schedules" className="text-muted-foreground hover:text-foreground transition-colors">
          Fee Schedules
        </Link>
        <span className="text-muted-foreground" aria-hidden>/</span>
        <span className="text-foreground font-medium">Assign Template</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start gap-6 mb-6">
        <div className="flex-1 min-w-[280px]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Finance · Fee Management</p>
          <h1 className="text-2xl font-bold text-foreground">Assign Fee Template</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Select a fee template and assign it to a school year and assessment band. The
            template&apos;s default amounts will be used, but you can add overrides afterward.
          </p>
        </div>
      </div>

      {activeTemplates.length === 0 ? (
        <div className="flex gap-3 p-4 bg-warning/10 border border-warning/30 rounded-md mb-6">
          <div className="shrink-0 w-5 h-5 flex items-center justify-center text-warning" aria-hidden>⚠</div>
          <div>
            <p className="text-[0.8125rem] font-semibold text-foreground">No Templates Available</p>
            <p className="text-[0.8125rem] text-muted-foreground m-0">
              You need to create fee templates before you can assign them to school years.
            </p>
            <Link href="/staff/finance/fee-templates/new" className="mt-3 inline-block">
              <Button size="sm">Create Fee Template</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Form card */}
          <div className="bg-card border border-border rounded-md">
            <div className="flex justify-between items-center gap-4 px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Assignment Details</h2>
            </div>
            <div className="p-5">
              <TemplateAssignmentForm
                templates={activeTemplates}
                schoolYears={allSchoolYears}
              />
            </div>
          </div>

          {/* Notes card */}
          <div className="flex gap-3 p-4 bg-muted border border-border rounded-md">
            <div className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground" aria-hidden>📋</div>
            <div>
              <p className="text-[0.8125rem] font-semibold text-foreground">Important Notes</p>
              <ul className="m-0 pl-5 text-[0.8125rem] text-muted-foreground list-disc">
                <li>Each assessment band can only have one active schedule per school year</li>
                <li>If you need to change amounts for a specific year, add overrides instead of creating a new template</li>
                <li>Deactivate the old schedule before creating a new one for the same band and year</li>
                <li>The effective date is usually the school year start date</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
