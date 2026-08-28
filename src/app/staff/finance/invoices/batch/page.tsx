import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import BatchInvoiceForm from "@/features/finance/components/invoices/BatchInvoiceForm";

export const metadata: Metadata = {
  title: "Batch Invoice Generation | SRAMS",
  description: "Generate invoices for multiple assessments by grade level",
};

function Breadcrumbs() {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link href="/staff/finance" className="hover:text-foreground transition-colors">
        Finance
      </Link>
      <ChevronRight className="h-4 w-4" />
      <Link href="/staff/finance/invoices" className="hover:text-foreground transition-colors">
        Invoices
      </Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-foreground font-medium">Batch Generate</span>
    </nav>
  );
}

export default async function BatchInvoicePage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "invoices:read")) {
    redirect("/staff/finance");
  }

  const [gradeLevels, activeSchoolYear] = await Promise.all([
    getGradeLevels(),
    getActiveSchoolYear(),
  ]);

  if (!activeSchoolYear) {
    return (
      <div className="container mx-auto p-6">
        <Breadcrumbs />
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Batch Invoice Generation
        </h1>
        <p className="text-secondary mt-1 mb-6">
          Generate invoices for multiple assessments
        </p>
        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-warning-foreground">
          No active school year found. Please set an active school year before generating invoices.
        </div>
      </div>
    );
  }

  // Map grade levels to the format expected by the form
  const gradeLevelOptions = gradeLevels.map((gl) => ({
    id: gl.id,
    name: gl.name,
  }));

  return (
    <div className="container mx-auto p-6">
      <Breadcrumbs />
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Batch Invoice Generation
      </h1>
      <p className="text-secondary mt-1 mb-6">
        Generate invoices for all eligible assessments in a grade level or section
      </p>

      <div className="max-w-2xl">
        <BatchInvoiceForm
          gradeLevels={gradeLevelOptions}
          schoolYearId={activeSchoolYear.id}
          schoolYearLabel={activeSchoolYear.label}
        />
      </div>
    </div>
  );
}
