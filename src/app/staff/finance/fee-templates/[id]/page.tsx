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
    <div className="px-8 py-6 max-w-[1200px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-4" aria-label="Breadcrumb">
        <Link href="/staff/finance/fee-templates" className="text-muted-foreground hover:text-foreground transition-colors">
          Fee Templates
        </Link>
        <span className="text-muted-foreground" aria-hidden>/</span>
        <span className="text-foreground font-medium">{template.name}</span>
      </nav>

      {/* Page header */}
      <div className="flex justify-between items-start gap-6 mb-6">
        <div className="flex-1 min-w-[280px]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Finance · Fee Management</p>
          <h1 className="text-2xl font-bold text-foreground">{template.name}</h1>
          <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
            <span className="inline-flex px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded">{bandLabel}</span>
            {!template.isActive && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">Inactive</span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {template.description}
            </p>
          )}
        </div>

        {/* Total KPI card */}
        <div className="flex flex-col gap-1 p-4 bg-card border border-border rounded-md">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Template Total</span>
          <span className="text-xl font-bold text-primary">
            {new Intl.NumberFormat("en-PH", {
              style: "currency",
              currency: "PHP",
            }).format(templateTotal)}
          </span>
          <span className="text-xs text-muted-foreground">
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
      <div className="flex gap-3 p-4 bg-muted border border-border rounded-md mt-6">
        <div className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground" aria-hidden>→</div>
        <div>
          <p className="text-[0.8125rem] font-semibold text-foreground">Next Steps</p>
          <p className="text-[0.8125rem] text-muted-foreground mb-2">
            Once you've added all fee items, assign this template to a school year.
          </p>
          <Link
            href="/staff/finance/fee-schedules/new"
            className="text-primary no-underline font-medium hover:underline"
          >
            Assign to School Year →
          </Link>
        </div>
      </div>
    </div>
  );
}
