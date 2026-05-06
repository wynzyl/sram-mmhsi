"use client";

import Link from "next/link";
import {
  DataCard,
  DataCardHeader,
  DataCardBody,
} from "@/components/ui/editorial/DataCard";
import { cn } from "@/lib/utils/cn";

export interface PendingEnrollmentRow {
  enrollmentId: string;
  referenceNumber: string;
  studentName: string;
  schoolYear: string;
  gradeLevel: string;
  /** Preformatted on the server (e.g. en-PH date). */
  queuedAtLabel: string;
}

interface PendingAssessmentsQueueProps {
  rows: PendingEnrollmentRow[];
  canCreate: boolean;
  /** Base path without trailing slash, e.g. `/admin/assessments` or `/staff/assessments`. */
  assessmentsBasePath?: string;
}

export default function PendingAssessmentsQueue({
  rows,
  canCreate,
  assessmentsBasePath = "/admin/assessments",
}: PendingAssessmentsQueueProps) {
  const count = rows.length;

  return (
    <DataCard className="animate-reveal-stagger stagger-delay-1">
      <DataCardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-charcoal">Fee assessment queue</h2>
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
            count > 0
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "bg-[var(--color-surface-2)] text-warm-gray"
          )}
          aria-live="polite"
        >
          {count === 0 ? "No pending" : `${count} pending`}
        </span>
      </DataCardHeader>
      <DataCardBody className="space-y-4">
        <p className="text-sm text-warm-gray">
          Each row is a <strong className="text-charcoal">pending</strong> enrollment. Open the fee
          assessment to build the one-time charge snapshot from your fee catalog; saving moves the
          enrollment to <strong className="text-charcoal">Assessed</strong>. Payments are tracked on
          the billing ledger afterward.
        </p>

        {!canCreate && (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-charcoal">
            You can view this queue. Contact an administrator or registrar with assessment permission
            to open fee assessments.
          </p>
        )}

        {count === 0 ? (
          <div
            className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-6 py-10 text-center"
            role="status"
          >
            <p className="font-display text-base font-semibold text-charcoal">
              No enrollments are waiting for assessment.
            </p>
            <p className="mt-2 text-sm text-warm-gray">
              New rows appear here when an enrollment is still <strong>Pending</strong> and has not
              yet received its fee assessment.
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Pending enrollments awaiting fee assessment">
            {rows.map((r) => (
              <li
                key={r.enrollmentId}
                className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface-2)]/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-display text-lg font-bold text-charcoal">{r.studentName}</p>
                  <p className="font-mono text-sm text-warm-gray">{r.referenceNumber}</p>
                  <p className="text-sm text-charcoal">
                    <span className="text-warm-gray">School year:</span> {r.schoolYear}
                    <span className="mx-2 text-warm-gray" aria-hidden>
                      ·
                    </span>
                    <span className="text-warm-gray">Grade:</span> {r.gradeLevel}
                  </p>
                  <p className="text-xs text-warm-gray">Queued {r.queuedAtLabel}</p>
                </div>
                {canCreate ? (
                  <div className="shrink-0 sm:pl-4">
                    <Link
                      href={`${assessmentsBasePath}/new/${r.enrollmentId}`}
                      className="inline-flex w-full items-center justify-center rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 sm:w-auto"
                    >
                      Open fee assessment
                    </Link>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DataCardBody>
    </DataCard>
  );
}
