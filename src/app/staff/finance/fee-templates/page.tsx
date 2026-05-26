import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAllFeeTemplates } from "@/features/finance/fee-templates/fee-templates.queries";
import { FeeTemplatesTable } from "@/features/finance/fee-templates/components/FeeTemplatesTable";
import { CreateTemplateModal } from "@/features/finance/fee-templates/components/CreateTemplateModal";

export const metadata = {
  title: "Fee Templates | SRAMS",
  description: "Manage reusable fee templates for assessment bands",
};

export default async function FeeTemplatesPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

  const templates = await getAllFeeTemplates();

  return (
    <div className="px-8 py-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start gap-6 mb-6">
        <div className="flex-1 min-w-[280px]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Finance · Fee Management</p>
          <h1 className="text-2xl font-bold text-foreground">Fee Templates</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Create reusable fee structures for each assessment band. Templates can be
            assigned to multiple school years.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <CreateTemplateModal />
        </div>
      </div>

      {/* Info callout */}
      <div className="flex gap-3 p-4 bg-muted border border-border rounded-md mb-6">
        <div className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground" aria-hidden>ℹ</div>
        <div>
          <p className="text-[0.8125rem] font-semibold text-foreground">How Templates Work</p>
          <ul className="m-0 pl-5 text-[0.8125rem] text-muted-foreground list-disc">
            <li>Create one template per assessment band (Casa, Lower Elem, etc.)</li>
            <li>Add fee items (tuition, fees, materials, discounts) to each template</li>
            <li>
              Assign templates to school years under{" "}
              <Link href="/staff/finance/fee-schedules" className="text-primary no-underline font-medium hover:underline">
                Fee Schedules
              </Link>
            </li>
            <li>Reuse templates across multiple years to save time</li>
            <li>Add year-specific overrides when amounts change without creating new templates</li>
          </ul>
        </div>
      </div>

      {/* Templates list */}
      <FeeTemplatesTable templates={templates} />
    </div>
  );
}
