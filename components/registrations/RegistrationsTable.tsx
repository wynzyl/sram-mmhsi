"use client";

import { StudentRowActionsMenu } from "@/components/students/StudentRowActionsMenu";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import { isIntakeDocumentsComplete, registrationStudentTypeLabel } from "@/lib/utils/intake-documents";

export interface RegistrationRow {
  id: string;
  studentId: string;
  studentName: string;
  referenceNumber: string;
  schoolYear: string;
  gradeLevel: string;
  studentType: string;
  intakeDocuments: EnrollmentIntakeDocuments | null;
  createdAt: Date;
}

interface RegistrationsTableProps {
  registrations: RegistrationRow[];
  emptyMessage?: string;
  /** Defaults to staff portal student URLs. */
  studentBasePath?: "/admin/students" | "/staff/students";
}

export default function RegistrationsTable({
  registrations,
  emptyMessage = "No registrations found.",
  studentBasePath = "/staff/students",
}: RegistrationsTableProps) {
  const colSpan = 8;

  return (
    <div className="table-wrapper">
      <table className="data-table" id="registrations-table">
        <thead>
          <tr>
            <th>Reference No.</th>
            <th>Name</th>
            <th>School Year</th>
            <th>Grade Level</th>
            <th>Enrollment type</th>
            <th>Requirements</th>
            <th>Registered</th>
            <th className="text-right w-px" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {registrations.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            registrations.map((reg) => (
              <tr key={reg.id} className="table-row-hover">
                <td>
                  <code className="reference-code">{reg.referenceNumber}</code>
                </td>
                <td className="student-name">{reg.studentName}</td>
                <td>{reg.schoolYear}</td>
                <td>{reg.gradeLevel}</td>
                <td>{registrationStudentTypeLabel(reg.studentType)}</td>
                <td>
                  {isIntakeDocumentsComplete(reg.intakeDocuments) ? (
                    <span className="badge badge-success">Complete</span>
                  ) : reg.intakeDocuments ? (
                    <span className="badge badge-warning">Incomplete</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="text-muted">
                  {new Date(reg.createdAt).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="text-right align-middle">
                  <StudentRowActionsMenu studentId={reg.studentId} studentBasePath={studentBasePath} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
