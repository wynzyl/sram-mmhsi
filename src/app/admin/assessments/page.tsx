import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  assessments,
  students,
  schoolYears,
  enrollments,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentsTable from "@/components/finance/AssessmentsTable";
import PendingAssessmentsQueue from "@/components/assessments/PendingAssessmentsQueue";

export const metadata: Metadata = {
  title: "Assessments",
  description: "Create assessments for pending enrollments and view billing ledgers.",
};

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function AssessmentsListPage({ searchParams }: PageProps) {
  const session = await requireSession();

  if (!hasPermission(session.role, "assessments:read")) {
    redirect("/admin/dashboard");
  }

  const { view } = await searchParams;
  const tab = view === "ledgers" ? "ledgers" : "pending";

  const canCreate = hasPermission(session.role, "assessments:create");

  const pendingRows = await db
    .select({
      enrollmentId: enrollments.id,
      referenceNumber: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(enrollments.status, "pending"))
    .orderBy(desc(enrollments.createdAt));

  const pendingData = pendingRows.map((r) => ({
    enrollmentId: r.enrollmentId,
    referenceNumber: r.referenceNumber,
    studentName: `${r.lastName}, ${r.firstName}`,
    schoolYear: r.schoolYear,
    gradeLevel: r.gradeLevel,
  }));

  const rows = await db
    .select({
      id: assessments.id,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
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
    billingStatus: r.billingStatus,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assessments</h1>
          <p className="page-subtitle">
            Registrar queue for pending enrollments, plus all billing ledgers.
          </p>
        </div>
      </div>

      <nav className="tab-nav" aria-label="Assessment views">
        <Link
          href="/admin/assessments?view=pending"
          className={`tab-link ${tab === "pending" ? "tab-link-active" : ""}`}
        >
          Awaiting assessment
          {pendingData.length ? ` (${pendingData.length})` : ""}
        </Link>
        <Link
          href="/admin/assessments?view=ledgers"
          className={`tab-link ${tab === "ledgers" ? "tab-link-active" : ""}`}
        >
          Assessment ledgers
        </Link>
      </nav>

      {tab === "pending" ? (
        <>
          {!canCreate && (
            <p className="text-muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
              You can view pending enrollments. Contact an administrator or registrar to create
              assessments.
            </p>
          )}
          <PendingAssessmentsQueue rows={pendingData} canCreate={canCreate} />
        </>
      ) : (
        <>
          <p className="text-muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
            Open a ledger for payment posting and balance history.
          </p>
          <AssessmentsTable assessments={tableData} />
        </>
      )}
    </div>
  );
}
