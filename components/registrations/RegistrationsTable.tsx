"use client";

import { StudentRowActionsMenu } from "@/components/students/StudentRowActionsMenu";

export interface RegistrationRow {
  id: string;
  studentId: string;
  studentName: string;
  referenceNumber: string;
  schoolYear: string;
  gradeLevel: string;
  createdAt: Date;
}

interface RegistrationsTableProps {
  registrations: RegistrationRow[];
  emptyMessage?: string;
}

export default function RegistrationsTable({
  registrations,
  emptyMessage = "No registrations found.",
}: RegistrationsTableProps) {
  const colSpan = 6;

  return (
    <div className="table-wrapper">
      <table className="data-table" id="registrations-table">
        <thead>
          <tr>
            <th>Reference No.</th>
            <th>Name</th>
            <th>School Year</th>
            <th>Grade Level</th>
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
                <td className="text-muted">
                  {new Date(reg.createdAt).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="text-right align-middle">
                  <StudentRowActionsMenu studentId={reg.studentId} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
