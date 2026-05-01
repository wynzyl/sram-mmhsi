"use client";

interface RegistrationRow {
  id: string;
  studentName: string;
  referenceNumber: string;
  schoolYear: string;
  gradeLevel: string;
  createdAt: Date;
}

interface RegistrationsTableProps {
  registrations: RegistrationRow[];
}

export default function RegistrationsTable({ registrations }: RegistrationsTableProps) {
  return (
    <div className="table-wrapper">
      <table className="data-table" id="registrations-table">
        <thead>
          <tr>
            <th>Reference No.</th>
            <th>Student Name</th>
            <th>School Year</th>
            <th>Grade Level</th>
            <th>Registered On</th>
          </tr>
        </thead>
        <tbody>
          {registrations.length === 0 ? (
            <tr>
              <td colSpan={5} className="table-empty">
                No registrations found.
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
