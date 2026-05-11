import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import { getAllFeeTemplates } from "@/features/finance/fee-templates/fee-templates.queries";
import { TemplateAssignmentForm } from "@/features/finance/fee-templates/components/TemplateAssignmentForm";

export const metadata = {
  title: "Assign Fee Template | SRAMS",
  description: "Assign a fee template to a school year and assessment band",
};

export default async function NewFeeSchedulePage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

  // Load available templates and school years
  const templates = await getAllFeeTemplates();
  const activeTemplates = templates.filter((t) => t.isActive);

  const allSchoolYears = await db.query.schoolYears.findMany({
    where: isNull(schoolYears.deletedAt),
    orderBy: [desc(schoolYears.startDate)],
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-600">
        <Link href="/staff/finance/fee-schedules" className="hover:underline">
          Fee Schedules
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Assign Template</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Assign Fee Template to School Year</h1>
        <p className="mt-2 text-gray-600">
          Select a fee template and assign it to a school year and assessment band. The
          template's default amounts will be used, but you can add overrides afterward.
        </p>
      </div>

      {/* Check if templates exist */}
      {activeTemplates.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="mb-2 font-semibold text-amber-900">No Templates Available</h3>
          <p className="mb-4 text-sm text-amber-800">
            You need to create fee templates before you can assign them to school years.
          </p>
          <Link href="/staff/finance/fee-templates/new">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              Create Fee Template
            </button>
          </Link>
        </div>
      ) : (
        <>
          {/* Form */}
          <div className="rounded-lg border bg-white p-6">
            <TemplateAssignmentForm
              templates={activeTemplates}
              schoolYears={allSchoolYears}
            />
          </div>

          {/* Help Text */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-2 font-semibold">Important Notes</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
              <li>Each assessment band can only have one active schedule per school year</li>
              <li>If you need to change amounts for a specific year, add overrides instead of creating a new template</li>
              <li>Deactivate the old schedule before creating a new one for the same band and year</li>
              <li>The effective date is usually the school year start date</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
