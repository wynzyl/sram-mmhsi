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
    <div className="px-8 py-6 max-w-[1200px] mx-auto">
      {/* Page header */}
      <div className="flex justify-between items-start gap-6 mb-6">
        <div className="flex-1 min-w-[280px]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Finance · Fee Management</p>
          <h1 className="text-2xl font-bold text-foreground">Fee Schedules</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Assign fee templates to school years. Each assessment band can have one
            active fee schedule per school year.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/staff/finance/fee-schedules/new">
            <Button>Assign Template</Button>
          </Link>
        </div>
      </div>

      {/* Info callout */}
      <div className="flex gap-3 p-4 bg-muted border border-border rounded-md mb-6">
        <div className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground" aria-hidden>ℹ</div>
        <div>
          <p className="text-[0.8125rem] font-semibold text-foreground">How It Works</p>
          <ul className="m-0 pl-5 text-[0.8125rem] text-muted-foreground list-disc">
            <li>
              Create reusable templates under{" "}
              <Link href="/staff/finance/fee-templates" className="text-primary no-underline font-medium hover:underline">
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
      <div className="flex flex-col gap-6">
        {allSchoolYears.map(async (schoolYear) => {
          const schedules = await getSchoolYearFeeSchedules(schoolYear.id);

          return (
            <div key={schoolYear.id} className="bg-card border border-border rounded-md">
              <div className="flex justify-between items-center gap-4 px-5 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-foreground">{schoolYear.label}</h2>
                  {schoolYear.isActive && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-500/15 text-green-500">Active Year</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(schoolYear.startDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  {" – "}
                  {new Date(schoolYear.endDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              <div className="p-5">
                {schedules.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground mb-2">No fee schedules assigned yet.</p>
                    <Link href="/staff/finance/fee-schedules/new">
                      <Button variant="secondary" size="sm">Assign Template</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
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
                        <div key={schedule.id} className={`bg-background border border-border rounded-md p-4${!schedule.isActive ? " opacity-60" : ""}`}>
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded">
                                {FEE_ASSESSMENT_BAND_LABELS[schedule.assessmentBand as keyof typeof FEE_ASSESSMENT_BAND_LABELS]}
                              </span>
                              {!schedule.isActive && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">Inactive</span>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
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

                          <p className="text-[0.9375rem] font-semibold text-foreground mb-2">{schedule.feeTemplate.name}</p>

                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                            <span>
                              {schedule.feeTemplate.items.length} item{schedule.feeTemplate.items.length !== 1 ? "s" : ""}
                            </span>
                            {schedule.overrides.length > 0 && (
                              <span className="text-amber-500">
                                {schedule.overrides.length} override{schedule.overrides.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            <span>
                              Effective: {new Date(schedule.effectiveDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                              {schedule.expiryDate && ` – ${new Date(schedule.expiryDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`}
                            </span>
                          </div>

                          <div className="text-lg font-bold text-foreground">
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
          <div className="bg-card border border-border rounded-md">
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-2">No school years configured. Set up school years first.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
