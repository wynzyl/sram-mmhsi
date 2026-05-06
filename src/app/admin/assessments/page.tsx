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
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";

export const metadata: Metadata = {
  title: "Assessments",
  description: "Create assessments for pending enrollments and view billing ledgers.",
};

const dateQueued = (d: Date) =>
  d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

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
      enrollmentCreatedAt: enrollments.createdAt,
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
    queuedAtLabel: dateQueued(r.enrollmentCreatedAt),
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
    <div className="page-container max-w-7xl">
      <SectionHeader
        size="md"
        accent
        title="Assessments"
        subtitle={
          tab === "pending" ? (
            <>
              <strong>Step 1:</strong> pick a student below, then complete the one-time fee assessment.
              <span className="mt-1 block text-sm text-warm-gray">
                <strong>Step 2:</strong> on the fee form, confirm catalog lines and save—the enrollment
                becomes <strong>Assessed</strong>. Use <strong>Assessment ledgers</strong> for payments
                and balances.
              </span>
            </>
          ) : (
            "Open a ledger to post payments, view OR history, and track outstanding balances after fee assessment."
          )
        }
      />

      <nav className="tab-nav mb-6" aria-label="Assessment views">
        <Link
          href="/admin/assessments?view=pending"
          className={`tab-link ${tab === "pending" ? "tab-link-active" : ""}`}
        >
          Fee assessment queue
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
        <PendingAssessmentsQueue
          rows={pendingData}
          canCreate={canCreate}
          assessmentsBasePath="/admin/assessments"
        />
      ) : (
        <AssessmentsTable assessments={tableData} assessmentsBasePath="/admin/assessments" />
      )}
    </div>
  );
}
