import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import BatchSendInvoiceForm from "@/features/finance/components/invoices/BatchSendInvoiceForm";

export const metadata: Metadata = {
  title: "Batch Send Invoices | SRAMS",
  description: "Send invoices via email to multiple guardians",
};

export default async function BatchSendInvoicePage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "invoices:send")) {
    redirect("/staff/finance/invoices");
  }

  const [activeSchoolYear, gradeLevels] = await Promise.all([
    getActiveSchoolYear(),
    getGradeLevels(),
  ]);

  if (!activeSchoolYear) {
    return (
      <div className="page-container--full space-y-6">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
            Batch Send Invoices
          </h1>
          <p className="text-sm text-muted-foreground">
            Send invoices via email to guardians
          </p>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">No Active School Year</h2>
          <p className="mt-2 text-sm text-amber-800">
            No active school year found. Please set an active school year before sending invoices.
          </p>
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
    <div className="page-container--full space-y-6">
      {/* Clean Page Header - Title + Subtitle Only */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
          Batch Send Invoices
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeSchoolYear.label} • Send invoices to guardians via email
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <BatchSendInvoiceForm
          gradeLevels={gradeLevelOptions}
          schoolYearId={activeSchoolYear.id}
          schoolYearLabel={activeSchoolYear.label}
        />
      </section>

      {/* Footer Note */}
      <p className="text-center text-[0.7rem] text-muted-foreground pb-2">
        Need to manage invoices?{" "}
        <Link
          href="/staff/finance/invoices"
          className="font-medium text-primary hover:underline"
        >
          Return to invoice list
        </Link>
        . Confidential institutional data.
      </p>
    </div>
  );
}
