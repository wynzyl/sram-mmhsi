import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FeeTemplateForm } from "@/features/finance/fee-templates/components/FeeTemplateForm";

export const metadata = {
  title: "Create Fee Template | SRAMS",
  description: "Create a new reusable fee template",
};

export default async function NewFeeTemplatePage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-600">
        <Link href="/staff/finance/fee-templates" className="hover:underline">
          Fee Templates
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">New Template</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create Fee Template</h1>
        <p className="mt-2 text-gray-600">
          Create a reusable fee structure for an assessment band. After creating the
          template, you can add fee items to it.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-lg border bg-white p-6">
        <FeeTemplateForm />
      </div>

      {/* Help Text */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-2 font-semibold">Next Steps</h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-gray-700">
          <li>Create the template with a name and assessment band</li>
          <li>Add fee items (tuition, fees, materials, discounts) to the template</li>
          <li>
            Assign the template to a school year under{" "}
            <Link
              href="/staff/finance/fee-schedules"
              className="font-medium text-primary underline"
            >
              Fee Schedules
            </Link>
          </li>
          <li>
            Optionally add year-specific overrides if amounts differ from the template
          </li>
        </ol>
      </div>
    </div>
  );
}
