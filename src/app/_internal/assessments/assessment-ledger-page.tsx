import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  assessments,
  assessmentItems,
  payments,
  students,
  schoolYears,
  receiptBooklets,
  users,
} from "@/lib/db/schema";
import { eq, desc, asc, and, lte } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentLedgerRegister from "@/components/cashier/AssessmentLedgerRegister";

export async function InternalAssessmentLedgerPage(props: {
  assessmentId: string;
  deniedRedirect: string;
  studentRecordsBasePath?: string;
}) {
  const { assessmentId: id, deniedRedirect, studentRecordsBasePath } = props;
  const session = await requireSession();

  if (!hasPermission(session.role, "assessments:read")) {
    redirect(deniedRedirect);
  }

  const assessment = await db
    .select({
      id: assessments.id,
      studentId: assessments.studentId,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
      studentName: students.lastName,
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
    .select({
      id: assessmentItems.id,
      description: assessmentItems.description,
      amount: assessmentItems.amount,
      isDiscount: assessmentItems.isDiscount,
    })
    .from(assessmentItems)
    .where(eq(assessmentItems.assessmentId, id))
    .orderBy(desc(assessmentItems.createdAt));

  const paymentRecords = await db
    .select({
      id: payments.id,
      orNumber: payments.orNumber,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      paymentDate: payments.paymentDate,
      status: payments.status,
      referenceNumber: payments.referenceNumber,
      processedByUsername: users.username,
    })
    .from(payments)
    .leftJoin(users, eq(payments.createdBy, users.id))
    .where(eq(payments.assessmentId, id))
    .orderBy(desc(payments.createdAt));

  const canPost = hasPermission(session.role, "payments:post");
  const canVoid = hasPermission(session.role, "payments:void");

  let activeBooklets: {
    id: string;
    series: string;
    prefix: string;
    nextNumber: number;
    endNumber: number;
  }[] = [];
  if (canPost) {
    activeBooklets = await db
      .select({
        id: receiptBooklets.id,
        series: receiptBooklets.series,
        prefix: receiptBooklets.prefix,
        nextNumber: receiptBooklets.nextNumber,
        endNumber: receiptBooklets.endNumber,
      })
      .from(receiptBooklets)
      .where(
        and(
          eq(receiptBooklets.status, "active"),
          lte(receiptBooklets.nextNumber, receiptBooklets.endNumber)
        )
      )
      .orderBy(asc(receiptBooklets.createdAt));
  }

  const ledgerPayments = paymentRecords.map((p) => ({
    id: p.id,
    orNumber: p.orNumber,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate.toISOString(),
    status: p.status,
    referenceNumber: p.referenceNumber,
    processedBy: p.processedByUsername ?? null,
  }));

  return (
    <div className="page-container">
      <AssessmentLedgerRegister
        {...(studentRecordsBasePath != null ? { studentRecordsBasePath } : {})}
        assessment={{
          id: assessment.id,
          studentId: assessment.studentId,
          studentLastName: assessment.studentName,
          studentFirstName: assessment.studentFirstName,
          schoolYear: assessment.schoolYear,
          totalAmount: assessment.totalAmount,
          totalPaid: assessment.totalPaid,
          balance: assessment.balance,
          billingStatus: assessment.billingStatus,
        }}
        items={items}
        payments={ledgerPayments}
        activeBooklets={activeBooklets}
        canPost={canPost}
        canVoid={canVoid}
      />
    </div>
  );
}
