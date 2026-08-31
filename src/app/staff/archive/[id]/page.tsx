import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import {
  getArchivedStudent,
  getStudentEnrollmentHistory,
  getStudentOutstandingBalanceTotal,
  getStudentRecentPayments,
} from "@/features/archive/archive.queries";
import { UnarchiveStudentDialog } from "@/features/archive/components/UnarchiveStudentDialog";
import {
  STUDENT_STATUS_LABELS,
  isArchivedStatus,
} from "@/lib/constants/student-status";
import {
  getStudentDocumentRequests,
  getSchoolYearOptions,
  checkDocumentRequestCreationEligibility,
} from "@/features/documents/document-requests.queries";
import { ArchivedStudentDocumentRequests } from "./ArchivedStudentDocumentRequests";

export const metadata: Metadata = {
  title: "Archived Student",
  description: "View archived student details.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArchivedStudentPage({ params }: PageProps) {
  const session = await requireSession();

  if (!hasPermission(session.role, "archive:read")) {
    redirect("/staff/dashboard");
  }

  const { id } = await params;
  const student = await getArchivedStudent(id);

  if (!student) {
    notFound();
  }

  // If student is active, redirect to the regular student page
  if (!isArchivedStatus(student.status)) {
    redirect(`/staff/students/${student.referenceNumber}`);
  }

  // Fetch related data
  const [
    enrollmentHistory,
    outstandingBalance,
    recentPayments,
    documentRequestsData,
    schoolYearOptions,
    docRequestEligibility,
  ] = await Promise.all([
    getStudentEnrollmentHistory(id),
    getStudentOutstandingBalanceTotal(id),
    getStudentRecentPayments(id),
    getStudentDocumentRequests(id),
    getSchoolYearOptions(),
    // Only check eligibility if user has permission
    hasPermission(session.role, "documents:create")
      ? checkDocumentRequestCreationEligibility(id)
      : Promise.resolve({ canCreate: false } as const),
  ]);

  const balance = parseFloat(outstandingBalance);
  const canManage = hasPermission(session.role, "archive:manage");
  // User needs both permission AND eligibility to create document requests
  const canCreateDocRequest =
    hasPermission(session.role, "documents:create") && docRequestEligibility.canCreate;
  const fullName = [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/staff/archive"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Archive
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-bold">{fullName}</h1>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={student.status} type="studentArchive" />
            <span className="text-sm text-muted-foreground">
              {student.referenceNumber}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <UnarchiveStudentDialog
              studentId={student.id}
              studentName={fullName}
              currentStatus={STUDENT_STATUS_LABELS[student.status]}
              trigger={<Button variant="secondary">Restore to Active</Button>}
            />
          )}
          {/* Payment button - always allowed for archived students */}
          <Link
            href={`/staff/payments?studentId=${student.id}`}
            className={buttonVariants({ variant: "primary" })}
          >
            Post Payment
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Student Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Full Name
              </p>
              <p>{fullName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Student ID
              </p>
              <p className="font-mono">{student.referenceNumber}</p>
            </div>
            {student.lrn && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">LRN</p>
                <p className="font-mono">{student.lrn}</p>
              </div>
            )}
            {student.dateOfBirth && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Date of Birth
                </p>
                <p>{formatDate(student.dateOfBirth)}</p>
              </div>
            )}
            {student.gender && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Gender
                </p>
                <p className="capitalize">{student.gender}</p>
              </div>
            )}
            {student.address && (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Address
                </p>
                <p>{student.address}</p>
              </div>
            )}
            {student.email && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Email
                </p>
                <p>{student.email}</p>
              </div>
            )}
            {student.mobileNumber && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Mobile Number
                </p>
                <p>{student.mobileNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Archive Info */}
        <Card>
          <CardHeader>
            <CardTitle>Archive Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <StatusBadge status={student.status} type="studentArchive" />
            </div>
            {student.archivedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Archived Date
                </p>
                <p>{formatDate(student.archivedAt)}</p>
              </div>
            )}
            {student.archivedSchoolYearLabel && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  School Year
                </p>
                <p>{student.archivedSchoolYearLabel}</p>
              </div>
            )}
            {student.archiveReason && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Reason
                </p>
                <p className="text-sm">{student.archiveReason}</p>
              </div>
            )}
            <hr />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Outstanding Balance
              </p>
              {balance > 0 ? (
                <p className="text-lg font-bold text-destructive">
                  <CurrencyDisplay amount={balance} />
                </p>
              ) : (
                <p className="text-lg font-bold text-success">Cleared</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollment History */}
      <Card>
        <CardHeader>
          <CardTitle>Enrollment History</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollmentHistory.length === 0 ? (
            <p className="text-muted-foreground">No enrollment records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted">
                    <th className="p-2 text-left font-medium">School Year</th>
                    <th className="p-2 text-left font-medium">Grade Level</th>
                    <th className="p-2 text-left font-medium">Status</th>
                    <th className="p-2 text-left font-medium">Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollmentHistory.map((enrollment) => (
                    <tr key={enrollment.id} className="border-b">
                      <td className="p-2">{enrollment.schoolYearLabel}</td>
                      <td className="p-2">{enrollment.gradeLevelName}</td>
                      <td className="p-2">
                        <StatusBadge
                          status={enrollment.status}
                          type="enrollment"
                        />
                      </td>
                      <td className="p-2">
                        {enrollment.enrolledAt
                          ? formatDate(enrollment.enrolledAt)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Payments</CardTitle>
          <Link
            href={`/staff/payments?studentId=${student.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            View All
          </Link>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-muted-foreground">No payment records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted">
                    <th className="p-2 text-left font-medium">OR Number</th>
                    <th className="p-2 text-left font-medium">Amount</th>
                    <th className="p-2 text-left font-medium">Date</th>
                    <th className="p-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="p-2 font-mono">
                        {payment.orNumber ?? "—"}
                      </td>
                      <td className="p-2">
                        <CurrencyDisplay amount={Number(payment.amount)} />
                      </td>
                      <td className="p-2">{formatDate(payment.paymentDate)}</td>
                      <td className="p-2">
                        <StatusBadge status={payment.status} type="payment" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Requests */}
      <ArchivedStudentDocumentRequests
        studentId={student.id}
        studentName={fullName}
        documentRequests={documentRequestsData}
        schoolYearOptions={schoolYearOptions}
        canCreateRequest={canCreateDocRequest}
      />
    </div>
  );
}
