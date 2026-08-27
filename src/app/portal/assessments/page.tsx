import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessments, schoolYears } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";

export const metadata = { title: "My Assessments" };

export default async function PortalAssessmentsPage() {
  const session = await requireSession();

  // Only allow portal sessions with direct studentId access
  if (session.accountSource !== "portal" || !session.studentId) {
    redirect("/login");
  }

  // Direct query using session.studentId (no complex lookup needed)
  const rows = await db
    .select({
      id: assessments.id,
      schoolYear: schoolYears.label,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
    })
    .from(assessments)
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .where(eq(assessments.studentId, session.studentId))
    .orderBy(desc(assessments.createdAt));

  const emptyCopy = rows.length === 0 ? (
    <p className="text-muted-foreground">No fee assessments on file yet.</p>
  ) : null;

  return (
    <PageContainer>
      <PageHeader title="Fee assessments" description="Outstanding balances by school year (read-only)." />

      {emptyCopy}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-foreground">School year</th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">Total</th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">Paid</th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">Balance</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Billing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">{r.schoolYear}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <CurrencyDisplay amount={Number(r.totalAmount)} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <CurrencyDisplay amount={Number(r.totalPaid)} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    <CurrencyDisplay amount={Number(r.balance)} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge type="billing" status={r.billingStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
