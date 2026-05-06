import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { db } from "@/lib/db";
import {
  assessments,
  enrollments,
  gradeLevels,
  payments,
  schoolYears,
  students,
} from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { CashierQueueTable } from "@/components/cashier/CashierQueueTable";
import { hasPermission } from "@/lib/rbac/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/data-display/CurrencyDisplay";
import { ReferenceCode } from "@/components/data-display/ReferenceCode";

export default async function CashierQueuePage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "payments:read")) {
    redirect("/login");
  }

  const todayTotalRow = await db
    .select({
      total: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
    })
    .from(payments)
    .where(
      and(eq(payments.status, "posted"), sql`DATE(${payments.paymentDate}) = CURRENT_DATE`)
    )
    .then((r) => r[0]);

  const totalCollectiblesRow = await db
    .select({
      total: sql<string>`COALESCE(SUM(${assessments.balance}::numeric), 0)`,
    })
    .from(assessments)
    .where(
      and(
        eq(assessments.billingStatus, "outstanding"),
        sql`${assessments.balance}::numeric > 0`
      )
    )
    .then((r) => r[0]);

  const studentAssessedRow = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(assessments)
    .where(sql`${assessments.billingStatus} != 'cancelled'`)
    .then((r) => r[0]);

  const rows = await db
    .select({
      assessmentId: assessments.id,
      balance: assessments.balance,
      totalPaid: assessments.totalPaid,
      billingStatus: assessments.billingStatus,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
      referenceNumber: students.referenceNumber,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      updatedAt: assessments.updatedAt,
      createdAt: assessments.createdAt,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(
      and(
        eq(assessments.billingStatus, "outstanding"),
        sql`${assessments.balance}::numeric > 0`
      )
    )
    .orderBy(desc(assessments.updatedAt), desc(assessments.createdAt));

  const recentCollections = await db
    .select({
      paymentId: payments.id,
      orNumber: payments.orNumber,
      amount: payments.amount,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    })
    .from(payments)
    .innerJoin(students, eq(payments.studentId, students.id))
    .where(eq(payments.status, "posted"))
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
    .limit(20);

  const data = rows.map((r) => ({
    assessmentId: r.assessmentId,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    referenceNumber: r.referenceNumber,
    gradeLevel: r.gradeLevel,
    schoolYear: r.schoolYear,
    billingStatus: r.billingStatus,
    balance: Number(r.balance),
    totalPaid: Number(r.totalPaid),
  }));

  const pendingPaymentsCount = data.length;
  const totalCollectedToday = Number(todayTotalRow?.total ?? 0);
  const totalCollectibles = Number(totalCollectiblesRow?.total ?? 0);
  const studentsAssessed = Number(studentAssessedRow?.count ?? 0);

  return (
    <PageContainer>
      <PageHeader
        title="Payment Queue"
        description="Newly assessed students and outstanding balances ready for posting."
      />

      <div className="mt-6 w-full">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Collection (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl font-black text-(--color-primary)">
                <CurrencyDisplay amount={totalCollectedToday} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl font-black text-charcoal">
                {pendingPaymentsCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Students Assessed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl font-black text-charcoal">
                {studentsAssessed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Collectibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl font-black text-charcoal">
                <CurrencyDisplay amount={totalCollectibles} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          <CashierQueueTable rows={data} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide text-(--color-text-muted)">
                Cashier Policy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="font-display text-2xl font-extrabold text-charcoal">
                Daily Reconciliation Reminder
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-(--color-text-2)">
                All cash and check transactions must be reconciled and closed before 4:30 PM.
                Ensure physical receipts match the digital ledger entries to avoid audit
                discrepancies. Contact your supervisor for partial-payment overrides and exception
                handling.
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Collections</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCollections.length === 0 ? (
                <p className="text-sm text-(--color-text-muted)">No posted payments yet.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {recentCollections.map((p) => (
                    <li
                      key={p.paymentId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-(--color-text)">
                          Receipt {p.orNumber ? <ReferenceCode code={p.orNumber} /> : "#—"}
                        </p>
                        <p className="mt-1 truncate text-xs text-(--color-text-muted)">
                          {p.studentLastName}, {p.studentFirstName}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-(--color-success)">
                        <CurrencyDisplay amount={Number(p.amount)} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
