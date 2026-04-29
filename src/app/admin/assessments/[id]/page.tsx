import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  assessments,
  assessmentItems,
  payments,
  students,
  schoolYears,
  receiptBooklets,
} from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import PostPaymentForm from "@/components/cashier/PostPaymentForm";
import PaymentsHistoryTable from "@/components/cashier/PaymentsHistoryTable";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Assessment Ledger",
};

export default async function AssessmentLedgerPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "assessments:read")) {
    redirect("/admin/dashboard");
  }

  const assessment = await db
    .select({
      id: assessments.id,
      studentId: assessments.studentId,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      studentName: students.lastName, // simplified
      studentFirstName: students.firstName,
      schoolYear: schoolYears.label,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .where(eq(assessments.id, id))
    .limit(1)
    .then((res) => res[0]);

  if (!assessment) notFound();

  const items = await db
    .select()
    .from(assessmentItems)
    .where(eq(assessmentItems.assessmentId, id))
    .orderBy(desc(assessmentItems.createdAt)); // Or order by some display order

  const paymentRecords = await db
    .select()
    .from(payments)
    .where(eq(payments.assessmentId, id))
    .orderBy(desc(payments.createdAt));

  const canPost = hasPermission(session.role, "payments:post");
  const canVoid = hasPermission(session.role, "payments:void");

  let activeBooklets: { id: string; series: string; nextNumber: number }[] = [];
  if (canPost) {
    activeBooklets = await db
      .select({
        id: receiptBooklets.id,
        series: receiptBooklets.series,
        nextNumber: receiptBooklets.nextNumber,
      })
      .from(receiptBooklets)
      .where(eq(receiptBooklets.status, "active"))
      .orderBy(asc(receiptBooklets.createdAt));
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Student Ledger: {assessment.studentName}, {assessment.studentFirstName}
          </h1>
          <p className="page-subtitle">School Year: {assessment.schoolYear}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Assessment Breakdown */}
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="card-title">Fee Breakdown</h2>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td style={{ textAlign: "right", color: item.isDiscount ? "var(--color-error)" : "inherit" }}>
                        {item.isDiscount ? "-" : ""}₱{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Payment History</h2>
            </div>
            <div className="card-body">
              <PaymentsHistoryTable payments={paymentRecords} canVoid={canVoid} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          {/* Summary */}
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="card-title">Summary</h2>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span>Total Assessed:</span>
                <span style={{ fontWeight: "bold" }}>₱{Number(assessment.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "var(--color-success)" }}>
                <span>Total Paid:</span>
                <span style={{ fontWeight: "bold" }}>₱{Number(assessment.totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <hr style={{ margin: "1rem 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem" }}>
                <span>Balance:</span>
                <span style={{ fontWeight: "bold", color: Number(assessment.balance) > 0 ? "var(--color-error)" : "inherit" }}>
                  ₱{Number(assessment.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Post Payment */}
          {canPost && Number(assessment.balance) > 0 && (
            <div className="card">
              <div className="card-header" style={{ backgroundColor: "var(--color-primary-light)" }}>
                <h2 className="card-title">Post Payment</h2>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <PostPaymentForm
                  studentId={assessment.studentId}
                  assessmentId={assessment.id}
                  balance={Number(assessment.balance)}
                  activeBooklets={activeBooklets}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
