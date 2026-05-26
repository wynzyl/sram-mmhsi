import { redirect } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { PORTAL_ROLES } from "@/lib/constants/roles";
import type { Role } from "@/lib/constants/roles";
import { getPortalStudentIds, getPortalStudentLabels } from "@/lib/queries/portal-student";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";

export const metadata = { title: "My Payments" };

export default async function PortalPaymentsPage() {
  const session = await requireSession();

  if (!PORTAL_ROLES.includes(session.role)) {
    redirect("/login");
  }

  const studentIds = await getPortalStudentIds(session.userId, session.role as Role);
  const labels = await getPortalStudentLabels(studentIds);
  const labelMap = Object.fromEntries(labels.map((s) => [s.id, s]));

  const rows =
    studentIds.length === 0
      ? []
      : await db
          .select({
            studentId: payments.studentId,
            id: payments.id,
            orNumber: payments.orNumber,
            amount: payments.amount,
            paymentMethod: payments.paymentMethod,
            paymentDate: payments.paymentDate,
            status: payments.status,
            referenceNumber: payments.referenceNumber,
          })
          .from(payments)
          .where(inArray(payments.studentId, studentIds))
          .orderBy(desc(payments.paymentDate));

  const emptyCopy =
    studentIds.length === 0 ? (
      <p className="text-muted-foreground">
        No learner profile is linked to your portal account yet. Ask the registrar to link your account if
        you believe this is an error.
      </p>
    ) : rows.length === 0 ? (
      <p className="text-muted-foreground">No posted payments on file yet.</p>
    ) : null;

  const showStudentColumn = studentIds.length > 1;

  return (
    <PageContainer>
      <PageHeader title="Payments" description="Official receipts and payment history (read-only)." />

      {emptyCopy}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                {showStudentColumn && (
                  <th className="px-4 py-2 text-left font-semibold text-foreground">Student</th>
                )}
                <th className="px-4 py-2 text-left font-semibold text-foreground">Date</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">OR #</th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Method</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Ref</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const who = labelMap[r.studentId];
                const name = who != null ? `${who.lastName}, ${who.firstName}` : "—";
                const dateLabel = r.paymentDate.toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    {showStudentColumn && (
                      <td className="px-4 py-3 text-foreground">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{who?.referenceNumber}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-foreground">{dateLabel}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{r.orNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <CurrencyDisplay amount={Number(r.amount)} />
                    </td>
                    <td className="px-4 py-3 capitalize text-foreground">{r.paymentMethod}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.referenceNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge type="payment" status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
