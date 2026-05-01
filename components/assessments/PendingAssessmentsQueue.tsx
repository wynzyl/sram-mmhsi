"use client";

import Link from "next/link";

interface PendingEnrollmentRow {
  enrollmentId: string;
  referenceNumber: string;
  studentName: string;
  schoolYear: string;
  gradeLevel: string;
}

interface PendingAssessmentsQueueProps {
  rows: PendingEnrollmentRow[];
  canCreate: boolean;
}

export default function PendingAssessmentsQueue({
  rows,
  canCreate,
}: PendingAssessmentsQueueProps) {
  return (
    <div className="table-wrapper">
      <table className="data-table" aria-label="Pending enrollments awaiting assessment">
        <thead>
          <tr>
            <th>Ref. No.</th>
            <th>Student</th>
            <th>School Year</th>
            <th>Grade</th>
            {canCreate && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={canCreate ? 5 : 4} className="table-empty">
                No enrollments are waiting for assessment.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.enrollmentId} className="table-row-hover">
                <td>
                  <code className="reference-code">{r.referenceNumber}</code>
                </td>
                <td style={{ fontWeight: 600 }}>{r.studentName}</td>
                <td>{r.schoolYear}</td>
                <td>{r.gradeLevel}</td>
                {canCreate && (
                  <td>
                    <Link
                      href={`/admin/assessments/new/${r.enrollmentId}`}
                      className="btn-primary btn-sm"
                    >
                      Build assessment
                    </Link>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
