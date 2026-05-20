"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

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

function initials(name: string): string {
  const parts = name.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    // "Last, First" format
    const last = parts[0].charAt(0);
    const first = parts[1].charAt(0);
    return `${first}${last}`.toUpperCase() || "?";
  }
  // Fallback for other formats
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase() || "?";
}

export default function AssessmentsTable({
  assessments,
  assessmentsBasePath = "/staff/assessments",
}: AssessmentsTableProps) {
  const colSpan = 7;

  return (
    <div className="table-wrapper rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
      <table className="data-table w-full text-left text-sm" id="assessments-ledger-table">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <th className="pl-4 font-semibold tracking-wide text-[var(--color-text-2)]">Student</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">School Year</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)] text-right">Total Assessed</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)] text-right">Total Paid</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)] text-right">Balance</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Status</th>
            <th className="w-px text-right font-semibold tracking-wide text-[var(--color-text-2)]" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {assessments.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty px-6 py-12 text-center text-[var(--color-text-muted)]">
                No assessments found.
              </td>
            </tr>
          ) : (
            assessments.map((assessment) => (
              <tr
                key={assessment.id}
                className="border-b border-[var(--color-border)] last:border-b-0 transition-colors hover:bg-[var(--color-surface-2)]/80"
              >
                <td className="align-middle py-3 pl-4 pr-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,var(--color-surface))] font-display text-sm font-bold text-[var(--color-primary)]"
                      aria-hidden
                    >
                      {initials(assessment.studentName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-text)]">
                        {assessment.studentName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="align-middle py-3 text-[var(--color-text)]">
                  {assessment.schoolYear}
                </td>
                <td className="align-middle py-3 text-right text-[var(--color-text)]">
                  <CurrencyDisplay amount={assessment.totalAmount} />
                </td>
                <td className="align-middle py-3 text-right text-[var(--color-success)]">
                  <CurrencyDisplay amount={assessment.totalPaid} />
                </td>
                <td className={`align-middle py-3 text-right font-bold ${assessment.balance > 0 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"}`}>
                  <CurrencyDisplay amount={assessment.balance} />
                </td>
                <td className="align-middle py-3">
                  <StatusBadge type="billing" status={assessment.billingStatus} />
                </td>
                <td className="align-middle py-3 text-right pr-4">
                  <Link
                    href={`${assessmentsBasePath}/${assessment.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white hover:opacity-95 transition-opacity"
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
