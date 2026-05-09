import { redirect } from "next/navigation";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessments, schoolYears } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { PORTAL_ROLES } from "@/lib/constants/roles";
import type { Role } from "@/lib/constants/roles";
import {
  getPortalStudentIds,
  getPortalStudentLabels,
} from "@/lib/queries/portal-student";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";

export const metadata = { title: "My Assessments" };

export default async function PortalAssessmentsPage() {
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
            studentId: assessments.studentId,
            id: assessments.id,
            schoolYear: schoolYears.label,
            totalAmount: assessments.totalAmount,
            totalPaid: assessments.totalPaid,
            balance: assessments.balance,
            billingStatus: assessments.billingStatus,
          })
          .from(assessments)
          .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
          .where(inArray(assessments.studentId, studentIds))
          .orderBy(desc(assessments.createdAt));

  const emptyCopy =
    studentIds.length === 0 ? (
      <p className="text-[var(--color-text-muted)]">
        No learner profile is linked to your portal account yet. Ask the registrar to link your account if
        you believe this is an error.
      </p>
    ) : rows.length === 0 ? (
      <p className="text-[var(--color-text-muted)]">No fee assessments on file yet.</p>
    ) : null;

  return (
    <PageContainer>
      <PageHeader title="Fee assessments" description="Outstanding balances by school year (read-only)." />

      {emptyCopy}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
              <tr>
                {(labels.length > 1 || studentIds.length > 1) && (
                  <th className="px-4 py-2 text-left font-semibold text-[var(--color-text)]">Student</th>
                )}
                <th className="px-4 py-2 text-left font-semibold text-[var(--color-text)]">School year</th>
                <th className="px-4 py-2 text-right font-semibold text-[var(--color-text)]">Total</th>
                <th className="px-4 py-2 text-right font-semibold text-[var(--color-text)]">Paid</th>
                <th className="px-4 py-2 text-right font-semibold text-[var(--color-text)]">Balance</th>
                <th className="px-4 py-2 text-left font-semibold text-[var(--color-text)]">Billing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const who = labelMap[r.studentId];
                const name =
                  who != null ? `${who.lastName}, ${who.firstName}` : "—";
                return (
                  <tr key={`${r.studentId}-${r.id}`} className="border-b border-[var(--color-border)] last:border-0">
                    {(labels.length > 1 || studentIds.length > 1) && (
                      <td className="px-4 py-3 text-[var(--color-text)]">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{who?.referenceNumber}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-[var(--color-text)]">{r.schoolYear}</td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
