import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getFeeScheduleById } from "@/features/finance/fee-templates/fee-templates.queries";
import {
  activateFeeScheduleAction,
  deactivateFeeScheduleAction,
} from "@/features/finance/fee-templates/fee-templates.actions";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/constants/assessment-bands";
import { formatDate } from "@/lib/utils/date";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Fee Schedule Details | SRAMS",
};

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export default async function FeeScheduleDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

  const schedule = await getFeeScheduleById(id);
  if (!schedule) notFound();

  const { feeTemplate, overrides } = schedule;

  const bandLabel =
    FEE_ASSESSMENT_BAND_LABELS[
      schedule.assessmentBand as keyof typeof FEE_ASSESSMENT_BAND_LABELS
    ] ?? schedule.assessmentBand;

  const sortedItems = [...feeTemplate.items].sort((a, b) => a.order - b.order);

  const netTotal = sortedItems.reduce((sum, item) => {
    const override = overrides.find((o) => o.feeTemplateItemId === item.id);
    const amount = Number(override?.overrideAmount ?? item.defaultAmount);
    return item.feeItemType.isDiscount ? sum - amount : sum + amount;
  }, 0);

  const hasOverrides = overrides.length > 0;

  return (
    <div className="px-8 py-6 max-w-[1200px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-4" aria-label="Breadcrumb">
        <Link href="/staff/finance/fee-schedules" className="text-muted-foreground hover:text-foreground transition-colors">
          Fee Schedules
        </Link>
        <span className="text-muted-foreground" aria-hidden>/</span>
        <span className="text-foreground font-medium">{feeTemplate.name}</span>
      </nav>

      {/* Page header */}
      <div className="flex justify-between items-start gap-6 mb-6">
        <div className="flex-1 min-w-[280px]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Finance · Fee Schedules</p>
          <h1 className="text-2xl font-bold text-foreground">{feeTemplate.name}</h1>
          <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
            <span className="inline-flex px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded">{bandLabel}</span>
            {!schedule.isActive && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">Inactive</span>
            )}
            {hasOverrides && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-warning/15 text-warning">
                {overrides.length} override{overrides.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {feeTemplate.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {feeTemplate.description}
            </p>
          )}
        </div>

        {/* Activate / Deactivate */}
        <div className="flex gap-2 shrink-0">
          {schedule.isActive ? (
            <InlineConfirmButton
              action={deactivateFeeScheduleAction}
              confirmMessage="Deactivate this fee schedule? New assessments will not be able to use it."
              hiddenFields={{ scheduleId: schedule.id }}
              label="Deactivate"
              loadingLabel="Deactivating…"
              variant="danger"
            />
          ) : (
            <InlineConfirmButton
              action={activateFeeScheduleAction}
              confirmMessage="Activate this fee schedule? It will become available for new assessments."
              hiddenFields={{ scheduleId: schedule.id }}
              label="Activate"
              loadingLabel="Activating…"
              variant="primary"
            />
          )}
        </div>

        {/* Net total KPI */}
        <div className="flex flex-col gap-1 p-4 bg-card border border-border rounded-md">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Net Total</span>
          <span className="text-xl font-bold text-primary">{formatPHP(netTotal)}</span>
          <span className="text-xs text-muted-foreground">
            {sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""}
            {hasOverrides ? ` · ${overrides.length} override${overrides.length !== 1 ? "s" : ""}` : ""}
          </span>
        </div>
      </div>

      {/* Effective dates panel */}
      <div className="bg-card border border-border rounded-md mb-6">
        <div className="flex justify-between items-center gap-4 px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Schedule Details</h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 px-6 py-5">
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Effective From
            </p>
            <p className="text-sm font-semibold text-foreground">
              {formatDate(schedule.effectiveDate)}
            </p>
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Expiry Date
            </p>
            <p className="text-sm font-semibold text-foreground">
              {formatDate(schedule.expiryDate)}
            </p>
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Status
            </p>
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${schedule.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {schedule.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Base Template
            </p>
            <Link
              href={`/staff/finance/fee-templates/${feeTemplate.id}`}
              className="text-sm font-semibold text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary"
            >
              {feeTemplate.name} →
            </Link>
          </div>
        </div>
      </div>

      {/* Fee items table */}
      <div className="bg-card border border-border rounded-md">
        <div className="flex justify-between items-center gap-4 px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Fee Items</h2>
          <span className="text-xs text-muted-foreground">{sortedItems.length} items</span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">No fee items in this template.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">#</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Fee Type</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Category</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Default Amount</th>
                  {hasOverrides && (
                    <th scope="col" className="px-4 py-2.5 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Override</th>
                  )}
                  <th scope="col" className="px-4 py-2.5 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Effective Amount</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const override = overrides.find((o) => o.feeTemplateItemId === item.id);
                  const effectiveAmount = Number(override?.overrideAmount ?? item.defaultAmount);
                  const defaultAmount = Number(item.defaultAmount);

                  return (
                    <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-[0.8125rem] text-muted-foreground text-right tabular-nums">{item.order}</td>
                      <td className="px-4 py-2.5 text-[0.8125rem] text-foreground">
                        <span className="font-medium">{item.feeItemType.name}</span>
                        {item.feeItemType.isDiscount && (
                          <span className="inline-flex ml-2 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-success bg-success/10 rounded">DISC</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[0.8125rem] text-muted-foreground capitalize">{item.feeItemType.category}</td>
                      <td className={`px-4 py-2.5 text-[0.8125rem] text-right tabular-nums ${override ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {item.feeItemType.isDiscount && <span className="mr-0.5">−</span>}
                        {formatPHP(defaultAmount)}
                      </td>
                      {hasOverrides && (
                        <td className="px-4 py-2.5 text-[0.8125rem] text-right">
                          {override ? (
                            <span className="text-warning font-semibold text-[0.8rem]">
                              {formatPHP(Number(override.overrideAmount))}
                              {override.reason && (
                                <span title={override.reason} className="ml-1 cursor-help">ⓘ</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-[0.8125rem] text-foreground text-right tabular-nums font-medium">
                        {item.feeItemType.isDiscount && <span className="mr-0.5">−</span>}
                        {formatPHP(effectiveAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30">
                  <td colSpan={hasOverrides ? 4 : 3} className="px-4 py-3 text-[0.8125rem]">
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">Net Total</span>
                  </td>
                  {hasOverrides && <td className="px-4 py-3" />}
                  <td className="px-4 py-3 text-right text-lg font-bold text-primary">{formatPHP(netTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
