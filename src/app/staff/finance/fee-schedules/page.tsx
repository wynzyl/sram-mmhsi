import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSchoolYearFeeSchedules } from "@/features/finance/fee-templates/fee-templates.queries";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/constants/assessment-bands";
import { Button } from "@/components/ui/button";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { deactivateFeeScheduleAction } from "@/features/finance/fee-templates/fee-templates.actions";

export const metadata: Metadata = {
  title: "Fee Schedules",
  description: "Manage fee schedule assignments per school year.",
};

export default async function StaffFeeSchedulesPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

  const allSchoolYears = await db.query.schoolYears.findMany({
    where: isNull(schoolYears.deletedAt),
    orderBy: [desc(schoolYears.startDate)],
  });

  return (
    <div className="fin-page">
      {/* Page header */}
      <div className="fin-page-header">
        <div className="fin-page-header-main">
          <p className="fin-eyebrow">Finance · Fee Management</p>
          <h1 className="fin-title">Fee Schedules</h1>
          <p className="fin-subtitle">
            Assign fee templates to school years. Each assessment band can have one
            active fee schedule per school year.
          </p>
        </div>
        <div className="fin-page-header-actions">
          <Link href="/staff/finance/fee-schedules/new">
            <Button>Assign Template</Button>
          </Link>
        </div>
      </div>

      {/* Info callout */}
      <div className="fin-callout">
        <div className="fin-callout-icon" aria-hidden>ℹ</div>
        <div>
          <p className="fin-callout-title">How It Works</p>
          <ul className="fin-callout-list">
            <li>
              Create reusable templates under{" "}
              <Link href="/staff/finance/fee-templates" className="fin-callout-link">
                Fee Templates
              </Link>
            </li>
            <li>Assign templates to school years here (one per band per year)</li>
            <li>Add year-specific overrides if amounts differ from the template</li>
            <li>When creating assessments, the active schedule is automatically used</li>
          </ul>
        </div>
      </div>

      {/* School years */}
      <div className="fin-stack">
        {allSchoolYears.map(async (schoolYear) => {
          const schedules = await getSchoolYearFeeSchedules(schoolYear.id);

          return (
            <div key={schoolYear.id} className="fin-panel">
              <div className="fin-panel-head">
                <div className="fin-panel-head-left">
                  <h2 className="fin-panel-title">{schoolYear.label}</h2>
                  {schoolYear.isActive && (
                    <span className="fin-badge fin-badge-active">Active Year</span>
                  )}
                </div>
                <span className="fin-panel-meta">
                  {new Date(schoolYear.startDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  {" – "}
                  {new Date(schoolYear.endDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              <div className="fin-panel-body">
                {schedules.length === 0 ? (
                  <div className="fin-empty">
                    <p className="fin-empty-text">No fee schedules assigned yet.</p>
                    <Link href="/staff/finance/fee-schedules/new">
                      <Button variant="secondary" size="sm">Assign Template</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="fin-schedule-grid">
                    {schedules.map((schedule) => {
                      const totalAmount = schedule.feeTemplate.items.reduce(
                        (sum, item) => {
                          const override = schedule.overrides.find(
                            (o) => o.feeTemplateItemId === item.id
                          );
                          const amount = Number(override?.overrideAmount ?? item.defaultAmount);
                          return item.feeItemType.isDiscount ? sum - amount : sum + amount;
                        },
                        0
                      );

                      return (
                        <div key={schedule.id} className={`fin-schedule-card${!schedule.isActive ? " fin-schedule-card-inactive" : ""}`}>
                          <div className="fin-schedule-card-top">
                            <div className="fin-schedule-card-meta">
                              <span className="fin-band-pill">
                                {FEE_ASSESSMENT_BAND_LABELS[schedule.assessmentBand as keyof typeof FEE_ASSESSMENT_BAND_LABELS]}
                              </span>
                              {!schedule.isActive && (
                                <span className="fin-badge fin-badge-muted">Inactive</span>
                              )}
                            </div>
                            <div className="fin-schedule-card-actions">
                              <Link href={`/staff/finance/fee-schedules/${schedule.id}`}>
                                <Button variant="secondary" size="sm">View Details</Button>
                              </Link>
                              {schedule.isActive && (
                                <InlineConfirmButton
                                  action={deactivateFeeScheduleAction}
                                  confirmMessage="Deactivate this fee schedule? New assessments will not be able to use it."
                                  hiddenFields={{ scheduleId: schedule.id }}
                                  label="Deactivate"
                                  loadingLabel="Deactivating..."
                                  variant="danger"
                                />
                              )}
                            </div>
                          </div>

                          <p className="fin-schedule-card-name">{schedule.feeTemplate.name}</p>

                          <div className="fin-schedule-card-stats">
                            <span className="fin-stat-item">
                              {schedule.feeTemplate.items.length} item{schedule.feeTemplate.items.length !== 1 ? "s" : ""}
                            </span>
                            {schedule.overrides.length > 0 && (
                              <span className="fin-stat-item fin-stat-override">
                                {schedule.overrides.length} override{schedule.overrides.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            <span className="fin-stat-date">
                              Effective: {new Date(schedule.effectiveDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                              {schedule.expiryDate && ` – ${new Date(schedule.expiryDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`}
                            </span>
                          </div>

                          <div className="fin-schedule-card-total">
                            {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(totalAmount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {allSchoolYears.length === 0 && (
          <div className="fin-panel">
            <div className="fin-empty">
              <p className="fin-empty-text">No school years configured. Set up school years first.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
