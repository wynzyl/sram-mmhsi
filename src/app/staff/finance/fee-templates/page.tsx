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
    <div className="fin-page">
      {/* Header */}
      <div className="fin-page-header">
        <div className="fin-page-header-main">
          <p className="fin-eyebrow">Finance · Fee Management</p>
          <h1 className="fin-title">Fee Templates</h1>
          <p className="fin-subtitle">
            Create reusable fee structures for each assessment band. Templates can be
            assigned to multiple school years.
          </p>
        </div>
        <div className="fin-page-header-actions">
          <CreateTemplateModal />
        </div>
      </div>

      {/* Info callout */}
      <div className="fin-callout">
        <div className="fin-callout-icon" aria-hidden>ℹ</div>
        <div>
          <p className="fin-callout-title">How Templates Work</p>
          <ul className="fin-callout-list">
            <li>Create one template per assessment band (Casa, Lower Elem, etc.)</li>
            <li>Add fee items (tuition, fees, materials, discounts) to each template</li>
            <li>
              Assign templates to school years under{" "}
              <Link href="/staff/finance/fee-schedules" className="fin-callout-link">
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
