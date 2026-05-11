import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAllFeeTemplates } from "@/features/finance/fee-templates/fee-templates.queries";
import { FeeTemplatesTable } from "@/features/finance/fee-templates/components/FeeTemplatesTable";
import { Button } from "@/components/ui/button";

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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fee Templates</h1>
            <p className="mt-2 text-gray-600">
              Create reusable fee structures for each assessment band. Templates can be
              assigned to multiple school years.
            </p>
          </div>

          <Link href="/staff/finance/fee-templates/new">
            <Button>Create Template</Button>
          </Link>
        </div>
      </div>

      {/* Info Card */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 font-semibold text-blue-900">How Templates Work</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Create one template per assessment band (Casa, Lower Elem, etc.)</li>
          <li>• Add fee items (tuition, fees, materials, discounts) to each template</li>
          <li>
            • Assign templates to school years under{" "}
            <Link
              href="/staff/finance/fee-schedules"
              className="font-medium underline"
            >
              Fee Schedules
            </Link>
          </li>
          <li>• Reuse templates across multiple years to save time</li>
          <li>
            • Add year-specific overrides when amounts change without creating new templates
          </li>
        </ul>
      </div>

      {/* Templates Table */}
      <FeeTemplatesTable templates={templates} />
    </div>
  );
}
