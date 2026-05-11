import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSchoolYearFeeSchedules } from "@/features/finance/fee-templates/fee-templates.queries";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";
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

  // Get all school years
  const allSchoolYears = await db.query.schoolYears.findMany({
    where: isNull(schoolYears.deletedAt),
    orderBy: [desc(schoolYears.startDate)],
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fee Schedules</h1>
            <p className="mt-2 text-gray-600">
              Assign fee templates to school years. Each assessment band can have one
              active fee schedule per school year.
            </p>
          </div>

          <Link href="/staff/finance/fee-schedules/new">
            <Button>Assign Template</Button>
          </Link>
        </div>
      </div>

      {/* Info Card */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 font-semibold text-blue-900">How It Works</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>
            • Create reusable templates under{" "}
            <Link
              href="/staff/finance/fee-templates"
              className="font-medium underline"
            >
              Fee Templates
            </Link>
          </li>
          <li>
            • Assign templates to school years here (one per band per year)
          </li>
          <li>• Add year-specific overrides if amounts differ from the template</li>
          <li>• When creating assessments, the active schedule is automatically used</li>
        </ul>
      </div>

      {/* School Years List */}
      <div className="space-y-6">
        {allSchoolYears.map(async (schoolYear) => {
          const schedules = await getSchoolYearFeeSchedules(schoolYear.id);

          return (
            <div key={schoolYear.id} className="rounded-lg border bg-white">
              <div className="border-b bg-gray-50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {schoolYear.label}
                    {schoolYear.isActive && (
                      <span className="ml-3 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Active
                      </span>
                    )}
                  </h3>
                  <div className="text-sm text-gray-600">
                    {new Date(schoolYear.startDate).toLocaleDateString()} -{" "}
                    {new Date(schoolYear.endDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {schedules.length === 0 ? (
                  <div className="text-center text-gray-500">
                    <p className="mb-3">No fee schedules assigned yet.</p>
                    <Link href="/staff/finance/fee-schedules/new">
                      <Button variant="secondary" size="sm">
                        Assign Template
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((schedule) => {
                      const totalAmount = schedule.feeTemplate.items.reduce(
                        (sum, item) => {
                          // Apply overrides
                          const override = schedule.overrides.find(
                            (o) => o.feeTemplateItemId === item.id
                          );
                          const amount = Number(
                            override?.overrideAmount ?? item.defaultAmount
                          );
                          return item.feeItemType.isDiscount
                            ? sum - amount
                            : sum + amount;
                        },
                        0
                      );

                      return (
                        <div
                          key={schedule.id}
                          className="rounded-lg border bg-gray-50 p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                  {FEE_ASSESSMENT_BAND_LABELS[schedule.assessmentBand as keyof typeof FEE_ASSESSMENT_BAND_LABELS]}
                                </span>
                                {!schedule.isActive && (
                                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                                    Inactive
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 font-medium">
                                {schedule.feeTemplate.name}
                              </div>

                              <div className="mt-1 text-sm text-gray-600">
                                {schedule.feeTemplate.items.length} items
                                {schedule.overrides.length > 0 && (
                                  <span className="ml-2 text-amber-600">
                                    ({schedule.overrides.length} override
                                    {schedule.overrides.length !== 1 ? "s" : ""})
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 text-lg font-semibold">
                                {new Intl.NumberFormat("en-PH", {
                                  style: "currency",
                                  currency: "PHP",
                                }).format(totalAmount)}
                              </div>

                              <div className="mt-1 text-xs text-gray-500">
                                Effective:{" "}
                                {new Date(
                                  schedule.effectiveDate
                                ).toLocaleDateString()}
                                {schedule.expiryDate && (
                                  <>
                                    {" "}
                                    - {new Date(schedule.expiryDate).toLocaleDateString()}
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Link
                                href={`/staff/finance/fee-schedules/${schedule.id}`}
                              >
                                <Button variant="secondary" size="sm">
                                  View Details
                                </Button>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
