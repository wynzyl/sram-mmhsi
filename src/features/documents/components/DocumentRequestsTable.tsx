"use client";

import Image from "next/image";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { SpedBadge } from "@/components/shared/SpedBadge";
import { formatDateTime } from "@/lib/utils/date";
import { getInitials } from "@/lib/utils/name";
import { DOCUMENT_REQUEST_TYPE_LABELS } from "@/lib/constants/document-requests";
import type { DocumentRequestListItem } from "../document-requests.queries";

const headClass =
  "font-semibold tracking-wide text-gray-600 dark:text-gray-400";

export function DocumentRequestsTable({
  rows,
  emptyMessage = "No document requests found.",
  showStudentLink = true,
}: {
  rows: DocumentRequestListItem[];
  emptyMessage?: string;
  showStudentLink?: boolean;
}) {
  const colSpan = showStudentLink ? 8 : 7;

  return (
    <div className="overflow-x-auto">
      <table
        className="data-table w-full text-left text-sm"
        id="document-requests-table"
      >
        <thead>
          <tr className="border-b border-border bg-muted">
            {showStudentLink && <th className={`${headClass} pl-4`}>Student</th>}
            <th className={showStudentLink ? headClass : `${headClass} pl-4`}>
              Document Type
            </th>
            <th className={headClass}>Copies</th>
            <th className={headClass}>Status</th>
            <th className={headClass}>Doc Number</th>
            <th className={headClass}>Fee</th>
            <th className={headClass}>Requested</th>
            <th className={`${headClass} pr-4`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-muted/50"
              >
                {showStudentLink && (
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-2">
                      {row.hasEscDiscount ? (
                        <Image
                          src="/ESC-Logo.png"
                          alt="ESC Grantee"
                          width={32}
                          height={32}
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                          title="ESC Grantee"
                          unoptimized
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary"
                          aria-hidden
                        >
                          {getInitials(row.studentName)}
                        </div>
                      )}
                      <div>
                        <span className="flex items-center">
                          <Link
                            href={`/staff/archive/${row.studentId}`}
                            prefetch={false}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {row.studentName}
                          </Link>
                          <SpedBadge isSped={row.isSpecialEducation} />
                        </span>
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.studentRef}
                        </p>
                      </div>
                    </div>
                  </td>
                )}
                <td className={showStudentLink ? "py-3" : "py-3 pl-4"}>
                  <span className="text-sm font-medium">
                    {DOCUMENT_REQUEST_TYPE_LABELS[row.documentType]}
                  </span>
                  {row.purpose && (
                    <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {row.purpose}
                    </p>
                  )}
                </td>
                <td className="py-3">
                  <span className="font-medium">{row.copies}</span>
                </td>
                <td className="py-3">
                  <StatusBadge status={row.status} type="documentRequest" />
                </td>
                <td className="py-3">
                  {row.documentNumber ? (
                    <span className="font-mono text-xs">{row.documentNumber}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3">
                  {row.feeAmount && parseFloat(row.feeAmount) > 0 ? (
                    <CurrencyDisplay amount={parseFloat(row.feeAmount!)} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3">
                  <div>
                    <span className="text-sm">{formatDateTime(row.requestedAt)}</span>
                    <p className="text-xs text-muted-foreground">
                      by {row.requestedByName}
                    </p>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <DocumentRequestActions request={row} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DocumentRequestActions({ request }: { request: DocumentRequestListItem }) {
  // Show different actions based on status
  switch (request.status) {
    case "requested":
      return (
        <div className="flex gap-2">
          <Link
            href={`/staff/archive/documents/${request.id}`}
            prefetch={false}
            className="text-sm text-primary hover:underline"
          >
            Process
          </Link>
        </div>
      );
    case "processing":
      return (
        <div className="flex gap-2">
          <Link
            href={`/staff/archive/documents/${request.id}`}
            prefetch={false}
            className="text-sm text-primary hover:underline"
          >
            Mark Ready
          </Link>
        </div>
      );
    case "ready":
      return (
        <div className="flex gap-2">
          <Link
            href={`/staff/archive/documents/${request.id}`}
            prefetch={false}
            className="text-sm text-primary hover:underline"
          >
            Release
          </Link>
        </div>
      );
    case "released":
    case "rejected":
    case "cancelled":
      return (
        <Link
          href={`/staff/archive/documents/${request.id}`}
          prefetch={false}
          className="text-sm text-muted-foreground hover:underline"
        >
          View
        </Link>
      );
    default:
      return null;
  }
}
