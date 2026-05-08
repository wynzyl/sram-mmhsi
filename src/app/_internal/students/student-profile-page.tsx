import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  students,
  parentsGuardians,
  studentGuardianLinks,
  enrollments,
  schoolYears,
  gradeLevels,
  sections,
  assessments,
  invoices,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  type StudentRecordStudent,
  type GuardianRow,
  type EnrollmentRecordRow,
  type AssessmentSummaryRow,
  type InvoiceSummaryRow,
  type CurrentPlacement,
  type StudentRecordFlags,
} from "@/components/students/StudentRecordProfile";
import { RegistrationDetailView } from "@/components/registrations/RegistrationDetailView";
import { getStudentRequirementsSnapshots } from "@/lib/queries/student-requirements-snapshots";

/** Caller must have verified `students:read` before render (thin route pages use `redirect` when missing). */
export async function InternalStudentProfilePage(props: {
  studentId: string;
  backHref: string;
}) {
  const { studentId: id, backHref } = props;

  const session = await requireSession();

  const canReadAssessments = hasPermission(session.role, "assessments:read");
  const canCreateAssessment = hasPermission(session.role, "assessments:create");
  const canReadInvoices = hasPermission(session.role, "invoices:read");
  const canEnroll = hasPermission(session.role, "enrollments:create");
  const canEditStudent = hasPermission(session.role, "students:update");
  const canPostPayments = hasPermission(session.role, "payments:post");

  const studentRow = await db.query.students.findFirst({
    where: eq(students.id, id),
    columns: {
      id: true,
      referenceNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      lrn: true,
      mobileNumber: true,
      email: true,
      nationality: true,
      bloodType: true,
      religion: true,
      previousSchool: true,
      submittedDocumentsNotes: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!studentRow) notFound();

  const student: StudentRecordStudent = {
    ...studentRow,
    dateOfBirth: studentRow.dateOfBirth ? new Date(studentRow.dateOfBirth) : null,
    createdAt: new Date(studentRow.createdAt),
  };

  const guardianLinks = await db
    .select({
      id: parentsGuardians.id,
      isPrimary: studentGuardianLinks.isPrimary,
      firstName: parentsGuardians.firstName,
      middleName: parentsGuardians.middleName,
      lastName: parentsGuardians.lastName,
      relationship: parentsGuardians.relationship,
      address: parentsGuardians.address,
      contactNumber: parentsGuardians.contactNumber,
      email: parentsGuardians.email,
    })
    .from(studentGuardianLinks)
    .innerJoin(parentsGuardians, eq(studentGuardianLinks.guardianId, parentsGuardians.id))
    .where(eq(studentGuardianLinks.studentId, id));

  const guardians: GuardianRow[] = guardianLinks;

  const enrollmentQueryRows = await db
    .select({
      id: enrollments.id,
      createdAt: enrollments.createdAt,
      enrolledAt: enrollments.enrolledAt,
      status: enrollments.status,
      studentType: enrollments.studentType,
      schoolYear: schoolYears.label,
      schoolYearIsActive: schoolYears.isActive,
      gradeLevel: gradeLevels.name,
      sectionName: sections.name,
      assessmentId: assessments.id,
    })
    .from(enrollments)
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .leftJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
    .where(eq(enrollments.studentId, id))
    .orderBy(desc(enrollments.createdAt));

  const enrollmentRows: EnrollmentRecordRow[] = enrollmentQueryRows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.createdAt),
    enrolledAt: row.enrolledAt ? new Date(row.enrolledAt) : null,
    status: row.status,
    studentType: row.studentType,
    schoolYear: row.schoolYear,
    schoolYearIsActive: row.schoolYearIsActive,
    gradeLevel: row.gradeLevel,
    sectionName: row.sectionName,
    assessmentId: row.assessmentId,
  }));

  let placement: CurrentPlacement = null;
  for (const row of enrollmentQueryRows) {
    if (row.status === "enrolled" && row.schoolYearIsActive) {
      placement = {
        schoolYear: row.schoolYear,
        gradeLevel: row.gradeLevel,
        sectionName: row.sectionName,
      };
      break;
    }
  }

  const [assessmentSummariesRaw, invoicesRaw, requirementsSnapshots] = await Promise.all([
    canReadAssessments
      ? db
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
          .where(eq(assessments.studentId, id))
          .orderBy(desc(assessments.createdAt))
      : Promise.resolve(
          [] as {
            id: string;
            schoolYear: string;
            totalAmount: string;
            totalPaid: string;
            balance: string;
            billingStatus: string;
          }[]
        ),
    canReadInvoices
      ? db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            amountDue: invoices.amountDue,
            status: invoices.status,
            dueDate: invoices.dueDate,
            createdAt: invoices.createdAt,
          })
          .from(invoices)
          .where(eq(invoices.studentId, id))
          .orderBy(desc(invoices.createdAt))
      : Promise.resolve(
          [] as {
            id: string;
            invoiceNumber: string;
            amountDue: string;
            status: string;
            dueDate: Date | null;
            createdAt: Date;
          }[]
        ),
    getStudentRequirementsSnapshots(id),
  ]);

  const assessmentSummaries: AssessmentSummaryRow[] = assessmentSummariesRaw;
  const invoiceRows: InvoiceSummaryRow[] = invoicesRaw.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    amountDue: inv.amountDue,
    status: inv.status,
    dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
    createdAt: new Date(inv.createdAt),
  }));

  const flags: StudentRecordFlags = {
    canReadAssessments,
    canCreateAssessment,
    canReadInvoices,
    canEnroll,
    canEditStudent,
    canPostPayments,
  };

  return (
    <RegistrationDetailView
      student={student}
      guardians={guardians}
      enrollments={enrollmentRows}
      requirementsSnapshots={requirementsSnapshots}
      placement={placement}
      assessmentSummaries={assessmentSummaries}
      invoices={invoiceRows}
      flags={flags}
      backHref={backHref}
      backLabel="Back to registrations"
    />
  );
}
