"use client";

import { memo } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StudentAvatarCell } from "@/components/shared/StudentAvatarCell";
import { TableEmptyState } from "@/components/shared/TableEmptyState";

interface Assessment {
  id: string;
  studentName: string;
  gradeLevel: string;
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


function AssessmentsTableComponent({
  assessments,
  assessmentsBasePath = "/staff/assessments",
}: AssessmentsTableProps) {
  const colSpan = 8;

  return (
    <div className="table-wrapper rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <table className="data-table w-full text-left text-sm" id="assessments-ledger-table">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="pl-4 font-semibold tracking-wide text-gray-600 dark:text-gray-400">Student</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Grade Level</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">School Year</th>
            <th className="pr-4 text-right font-semibold tracking-wide text-gray-600 dark:text-gray-400">Total Assessed</th>
            <th className="pr-4 text-right font-semibold tracking-wide text-gray-600 dark:text-gray-400">Total Paid</th>
            <th className="pr-4 text-right font-semibold tracking-wide text-gray-600 dark:text-gray-400">Balance</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Status</th>
            <th className="w-px text-right font-semibold tracking-wide text-gray-600 dark:text-gray-400" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {assessments.length === 0 ? (
            <TableEmptyState
              message="No assessments found."
              colSpan={colSpan}
            />
          ) : (
            assessments.map((assessment) => (
              <tr
                key={assessment.id}
                className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/80"
              >
                <td className="align-middle py-3 pl-4 pr-4">
                  <StudentAvatarCell name={assessment.studentName} />
                </td>
                <td className="align-middle py-3 text-foreground">
                  {assessment.gradeLevel}
                </td>
                <td className="align-middle py-3 text-foreground">
                  {assessment.schoolYear}
                </td>
                <td className="align-middle py-3 pr-4 text-right text-foreground">
                  <CurrencyDisplay amount={assessment.totalAmount} />
                </td>
                <td className="align-middle py-3 pr-4 text-right text-emerald-600">
                  <CurrencyDisplay amount={assessment.totalPaid} />
                </td>
                <td className={`align-middle py-3 pr-4 text-right font-bold ${assessment.balance > 0 ? "text-destructive" : "text-foreground"}`}>
                  <CurrencyDisplay amount={assessment.balance} />
                </td>
                <td className="align-middle py-3">
                  <StatusBadge type="billing" status={assessment.billingStatus} />
                </td>
                <td className="align-middle py-3 text-right pr-4">
                  <Link
                    href={`${assessmentsBasePath}/${assessment.id}`}
                    prefetch={false}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:opacity-95 transition-opacity"
                  >
                    Ledger
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

// Memoize to prevent unnecessary re-renders when parent state changes
const AssessmentsTable = memo(AssessmentsTableComponent);

export default AssessmentsTable;
