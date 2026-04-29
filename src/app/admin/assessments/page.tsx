import type { Metadata } from "next";
import { db } from "@/lib/db";
import { assessments, students, schoolYears } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentsTable from "@/components/finance/AssessmentsTable";

export const metadata: Metadata = {
  title: "Assessments",
  description: "View and manage student financial ledgers.",
};

export default async function AssessmentsListPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "assessments:read")) {
    redirect("/admin/dashboard");
  }

  const rows = await db
    .select({
      id: assessments.id,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      studentLastName: students.lastName,
      studentFirstName: students.firstName,
      schoolYear: schoolYears.label,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .orderBy(desc(assessments.createdAt));

  const tableData = rows.map((r) => ({
    id: r.id,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    schoolYear: r.schoolYear,
    totalAmount: Number(r.totalAmount),
    totalPaid: Number(r.totalPaid),
    balance: Number(r.balance),
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assessments</h1>
          <p className="page-subtitle">View student financial ledgers and process payments.</p>
        </div>
      </div>

      <AssessmentsTable assessments={tableData} />
    </div>
  );
}
