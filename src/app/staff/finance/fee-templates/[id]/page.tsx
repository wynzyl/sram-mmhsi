import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  getFeeTemplateById,
  getAllFeeItemTypes,
} from "@/features/finance/fee-templates/fee-templates.queries";
import { FeeTemplateItemsManager } from "@/features/finance/fee-templates/components/FeeTemplateItemsManager";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";

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

  if (!template) {
    notFound();
  }

  const allFeeTypes = await getAllFeeItemTypes();

  // Calculate template total
  const templateTotal = template.items.reduce((sum, item) => {
    const amount = Number(item.defaultAmount);
    return item.feeItemType.isDiscount ? sum - amount : sum + amount;
  }, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-600">
        <Link href="/staff/finance/fee-templates" className="hover:underline">
          Fee Templates
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{template.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{template.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {FEE_ASSESSMENT_BAND_LABELS[template.assessmentBand as keyof typeof FEE_ASSESSMENT_BAND_LABELS]}
              </span>
              {!template.isActive && (
                <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
                  Inactive
                </span>
              )}
            </div>
            {template.description && (
              <p className="mt-2 text-gray-600">{template.description}</p>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-600">Template Total</div>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(templateTotal)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {template.items.length} item{template.items.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Items Manager */}
      <FeeTemplateItemsManager
        templateId={template.id}
        items={template.items}
        availableFeeTypes={allFeeTypes}
      />

      {/* Actions */}
      <div className="mt-8 rounded-lg border bg-gray-50 p-4">
        <h3 className="mb-3 font-semibold">Next Steps</h3>
        <div className="space-y-2 text-sm">
          <p>
            Once you've added all fee items to this template, you can assign it to a
            school year:
          </p>
          <Link
            href="/staff/finance/fee-schedules/new"
            className="inline-block font-medium text-primary hover:underline"
          >
            → Assign to School Year
          </Link>
        </div>
      </div>
    </div>
  );
}
