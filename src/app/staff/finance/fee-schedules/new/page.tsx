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
    <div className="fin-page fin-page-narrow">
      {/* Breadcrumb */}
      <nav className="fin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/staff/finance/fee-schedules" className="fin-breadcrumb-link">
          Fee Schedules
        </Link>
        <span className="fin-breadcrumb-sep" aria-hidden>/</span>
        <span className="fin-breadcrumb-current">Assign Template</span>
      </nav>

      {/* Header */}
      <div className="fin-page-header">
        <div className="fin-page-header-main">
          <p className="fin-eyebrow">Finance · Fee Management</p>
          <h1 className="fin-title">Assign Fee Template</h1>
          <p className="fin-subtitle">
            Select a fee template and assign it to a school year and assessment band. The
            template's default amounts will be used, but you can add overrides afterward.
          </p>
        </div>
      </div>

      {activeTemplates.length === 0 ? (
        <div className="fin-callout fin-callout-warn">
          <div className="fin-callout-icon" aria-hidden>⚠</div>
          <div>
            <p className="fin-callout-title">No Templates Available</p>
            <p className="fin-callout-body">
              You need to create fee templates before you can assign them to school years.
            </p>
            <Link href="/staff/finance/fee-templates/new" className="mt-3 inline-block">
              <Button size="sm">Create Fee Template</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="fin-stack">
          {/* Form card */}
          <div className="fin-panel">
            <div className="fin-panel-head">
              <h2 className="fin-panel-title">Assignment Details</h2>
            </div>
            <div className="fin-panel-body fin-panel-body-form">
              <TemplateAssignmentForm
                templates={activeTemplates}
                schoolYears={allSchoolYears}
              />
            </div>
          </div>

          {/* Notes card */}
          <div className="fin-callout fin-callout-muted">
            <div className="fin-callout-icon" aria-hidden>📋</div>
            <div>
              <p className="fin-callout-title">Important Notes</p>
              <ul className="fin-callout-list">
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
