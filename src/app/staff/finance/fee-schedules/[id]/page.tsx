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
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";

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

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
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
    <div className="fin-page">
      {/* Breadcrumb */}
      <nav className="fin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/staff/finance/fee-schedules" className="fin-breadcrumb-link">
          Fee Schedules
        </Link>
        <span className="fin-breadcrumb-sep" aria-hidden>/</span>
        <span className="fin-breadcrumb-current">{feeTemplate.name}</span>
      </nav>

      {/* Page header */}
      <div className="fin-page-header">
        <div className="fin-page-header-main">
          <p className="fin-eyebrow">Finance · Fee Schedules</p>
          <h1 className="fin-title">{feeTemplate.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginTop: "0.625rem", flexWrap: "wrap" }}>
            <span className="fin-band-pill">{bandLabel}</span>
            {!schedule.isActive && (
              <span className="fin-badge fin-badge-muted">Inactive</span>
            )}
            {hasOverrides && (
              <span className="fin-badge fin-badge-warn">
                {overrides.length} override{overrides.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {feeTemplate.description && (
            <p className="fin-subtitle" style={{ marginTop: "0.5rem" }}>
              {feeTemplate.description}
            </p>
          )}
        </div>

        {/* Activate / Deactivate */}
        <div className="fin-page-header-actions">
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
        <div className="fin-kpi-card">
          <span className="fin-kpi-label">Net Total</span>
          <span className="fin-kpi-value">{formatPHP(netTotal)}</span>
          <span className="fin-kpi-sub">
            {sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""}
            {hasOverrides ? ` · ${overrides.length} override${overrides.length !== 1 ? "s" : ""}` : ""}
          </span>
        </div>
      </div>

      {/* Effective dates panel */}
      <div className="fin-panel">
        <div className="fin-panel-head">
          <h2 className="fin-panel-title">Schedule Details</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", padding: "1.25rem 1.5rem" }}>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-ops-muted)", marginBottom: "0.25rem" }}>
              Effective From
            </p>
            <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-ops-ink)" }}>
              {formatDate(schedule.effectiveDate)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-ops-muted)", marginBottom: "0.25rem" }}>
              Expiry Date
            </p>
            <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-ops-ink)" }}>
              {formatDate(schedule.expiryDate)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-ops-muted)", marginBottom: "0.25rem" }}>
              Status
            </p>
            <span className={`fin-badge ${schedule.isActive ? "fin-badge-active" : "fin-badge-muted"}`}>
              {schedule.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-ops-muted)", marginBottom: "0.25rem" }}>
              Base Template
            </p>
            <Link
              href={`/staff/finance/fee-templates/${feeTemplate.id}`}
              style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-primary)", textDecoration: "underline", textDecorationColor: "color-mix(in srgb, var(--color-primary) 30%, transparent)" }}
            >
              {feeTemplate.name} →
            </Link>
          </div>
        </div>
      </div>

      {/* Fee items table */}
      <div className="fin-panel">
        <div className="fin-panel-head">
          <h2 className="fin-panel-title">Fee Items</h2>
          <span className="fin-panel-meta">{sortedItems.length} items</span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="fin-empty">
            <p className="fin-empty-text">No fee items in this template.</p>
          </div>
        ) : (
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th scope="col" className="fin-th fin-th-num">#</th>
                  <th scope="col" className="fin-th">Fee Type</th>
                  <th scope="col" className="fin-th">Category</th>
                  <th scope="col" className="fin-th fin-th-num">Default Amount</th>
                  {hasOverrides && (
                    <th scope="col" className="fin-th fin-th-num">Override</th>
                  )}
                  <th scope="col" className="fin-th fin-th-num">Effective Amount</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const override = overrides.find((o) => o.feeTemplateItemId === item.id);
                  const effectiveAmount = Number(override?.overrideAmount ?? item.defaultAmount);
                  const defaultAmount = Number(item.defaultAmount);

                  return (
                    <tr key={item.id} className="fin-tr">
                      <td className="fin-td fin-td-num fin-td-muted">{item.order}</td>
                      <td className="fin-td">
                        <span className="fin-td-name">{item.feeItemType.name}</span>
                        {item.feeItemType.isDiscount && (
                          <span className="fin-disc-tag">DISC</span>
                        )}
                      </td>
                      <td className="fin-td fin-td-muted capitalize">{item.feeItemType.category}</td>
                      <td className="fin-td fin-td-num fin-td-amount" style={override ? { color: "var(--color-ops-muted)", textDecoration: "line-through" } : undefined}>
                        {item.feeItemType.isDiscount && <span className="fin-minus">−</span>}
                        {formatPHP(defaultAmount)}
                      </td>
                      {hasOverrides && (
                        <td className="fin-td fin-td-num">
                          {override ? (
                            <span style={{ color: "var(--color-ops-warning, #f59e0b)", fontWeight: 600, fontSize: "0.8rem" }}>
                              {formatPHP(Number(override.overrideAmount))}
                              {override.reason && (
                                <span title={override.reason} style={{ marginLeft: "0.3rem", cursor: "help" }}>ⓘ</span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: "var(--color-ops-muted)", fontSize: "0.75rem" }}>—</span>
                          )}
                        </td>
                      )}
                      <td className="fin-td fin-td-num fin-td-amount">
                        {item.feeItemType.isDiscount && <span className="fin-minus">−</span>}
                        {formatPHP(effectiveAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="fin-tfoot-row">
                  <td colSpan={hasOverrides ? 4 : 3} className="fin-td">
                    <span className="fin-tfoot-label">Net Total</span>
                  </td>
                  {hasOverrides && <td className="fin-td" />}
                  <td className="fin-td fin-td-num fin-tfoot-total">{formatPHP(netTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
