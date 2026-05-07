"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/data-display/StatusBadge";

interface Assessment {
  id: string;
  studentName: string;
  schoolYear: string;
  totalAmount: number;
  totalPaid: number;
  balance: number;
  billingStatus: string;
}

interface AssessmentsTableProps {
  assessments: Assessment[];
  /** Base path without trailing slash for ledger links. */
  assessmentsBasePath?: string;
}

export default function AssessmentsTable({
  assessments,
  assessmentsBasePath = "/staff/assessments",
}: AssessmentsTableProps) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>School Year</th>
            <th style={{ textAlign: "right" }}>Total Assessed</th>
            <th style={{ textAlign: "right" }}>Total Paid</th>
            <th style={{ textAlign: "right" }}>Balance</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {assessments.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-empty">
                No assessments found.
              </td>
            </tr>
          ) : (
            assessments.map((assessment) => (
              <tr key={assessment.id} className="table-row-hover">
                <td style={{ fontWeight: 600 }}>{assessment.studentName}</td>
                <td>{assessment.schoolYear}</td>
                <td style={{ textAlign: "right" }}>
                  ₱{assessment.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: "right", color: "var(--color-success)" }}>
                  ₱{assessment.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: "right", fontWeight: "bold", color: assessment.balance > 0 ? "var(--color-error)" : "inherit" }}>
                  ₱{assessment.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td>
                  <StatusBadge type="billing" status={assessment.billingStatus} />
                </td>
                <td>
                  <Link
                    href={`${assessmentsBasePath}/${assessment.id}`}
                    className="btn-primary btn-sm"
                  >
                    View Ledger
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
