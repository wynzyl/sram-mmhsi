import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  getFeeTemplateById,
  getAllFeeItemTypes,
} from "@/features/finance/fee-templates/fee-templates.queries";
import { FeeTemplateItemsManager } from "@/features/finance/fee-templates/components/FeeTemplateItemsManager";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/constants/assessment-bands";

export const metadata = {
  title: "Fee Template Details | SRAMS",
  description: "View and manage fee template items",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FeeTemplateDetailPage(props: PageProps) {
  const params = await props.params;
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

  const template = await getFeeTemplateById(params.id);
  if (!template) notFound();

  const allFeeTypes = await getAllFeeItemTypes();

  const templateTotal = template.items.reduce((sum, item) => {
    const amount = Number(item.defaultAmount);
    return item.feeItemType.isDiscount ? sum - amount : sum + amount;
  }, 0);

  const bandLabel =
    FEE_ASSESSMENT_BAND_LABELS[
      template.assessmentBand as keyof typeof FEE_ASSESSMENT_BAND_LABELS
    ];

  return (
    <div className="fin-page">
      {/* Breadcrumb */}
      <nav className="fin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/staff/finance/fee-templates" className="fin-breadcrumb-link">
          Fee Templates
        </Link>
        <span className="fin-breadcrumb-sep" aria-hidden>/</span>
        <span className="fin-breadcrumb-current">{template.name}</span>
      </nav>

      {/* Page header */}
      <div className="fin-page-header">
        <div className="fin-page-header-main">
          <p className="fin-eyebrow">Finance · Fee Management</p>
          <h1 className="fin-title">{template.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginTop: "0.625rem", flexWrap: "wrap" }}>
            <span className="fin-band-pill">{bandLabel}</span>
            {!template.isActive && (
              <span className="fin-badge fin-badge-muted">Inactive</span>
            )}
          </div>
          {template.description && (
            <p className="fin-subtitle" style={{ marginTop: "0.5rem" }}>
              {template.description}
            </p>
          )}
        </div>

        {/* Total KPI card */}
        <div className="fin-kpi-card">
          <span className="fin-kpi-label">Template Total</span>
          <span className="fin-kpi-value">
            {new Intl.NumberFormat("en-PH", {
              style: "currency",
              currency: "PHP",
            }).format(templateTotal)}
          </span>
          <span className="fin-kpi-sub">
            {template.items.length} item{template.items.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Items table with modal trigger in panel header */}
      <FeeTemplateItemsManager
        templateId={template.id}
        items={template.items}
        availableFeeTypes={allFeeTypes}
      />

      {/* Next steps callout */}
      <div className="fin-callout fin-callout-muted">
        <div className="fin-callout-icon" aria-hidden>→</div>
        <div>
          <p className="fin-callout-title">Next Steps</p>
          <p className="fin-callout-body" style={{ marginBottom: "0.5rem" }}>
            Once you've added all fee items, assign this template to a school year.
          </p>
          <Link
            href="/staff/finance/fee-schedules/new"
            className="fin-callout-link"
          >
            Assign to School Year →
          </Link>
        </div>
      </div>
    </div>
  );
}
