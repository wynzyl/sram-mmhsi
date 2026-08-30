"use client";

import { Button } from "@/components/ui/button";
import { SkeletonTable } from "@/components/ui/skeleton";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils/date";
import { usePortalPayments } from "@/features/payments/hooks/use-portal-payments";
import type { PortalPaymentRow } from "@/features/payments/payments.types";
import {
  PortalPage,
  PortalSection,
  PortalMetric,
  PortalMetricGroup,
  PortalRecordList,
  type PortalRecordColumn,
} from "@/features/portal/components";

const PAGE_TITLE = "Payments";
const PAGE_DESCRIPTION = "Official receipts and payment history (read-only).";

const columns: PortalRecordColumn<PortalPaymentRow>[] = [
  {
    key: "date",
    label: "Date",
    mobile: "primary",
    render: (r) =>
      formatDate(r.paymentDate, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  },
  {
    key: "orNumber",
    label: "OR number",
    mobile: "primary",
    render: (r) =>
      r.orNumber ? (
        <span className="font-[family-name:var(--font-mono)]">{r.orNumber}</span>
      ) : (
        <>
          <span aria-hidden="true" className="text-muted-foreground">
            -
          </span>
          <span className="sr-only">No official receipt number</span>
        </>
      ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "end",
    mobile: "primary",
    render: (r) => <CurrencyDisplay amount={r.amount} />,
  },
  {
    key: "method",
    label: "Method",
    mobile: "secondary",
    render: (r) => <span className="capitalize">{r.paymentMethod}</span>,
  },
  {
    key: "reference",
    label: "Reference",
    mobile: "secondary",
    render: (r) =>
      r.paymentReference ?? (
        <>
          <span aria-hidden="true">-</span>
          <span className="sr-only">No reference number</span>
        </>
      ),
  },
  {
    key: "status",
    label: "Status",
    mobile: "secondary",
    // paymentRecord, not payment: this column shows the status of an
    // individual receipt (posted / voided / reversed), which the paid /
    // partial / unpaid vocabulary does not model.
    render: (r) => <StatusBadge type="paymentRecord" status={r.status} />,
  },
];

type YearGroup = {
  id: string;
  label: string;
  gradeLevelName: string | null;
  payments: PortalPaymentRow[];
  total: number;
};

function groupBySchoolYear(rows: PortalPaymentRow[]): YearGroup[] {
  const grouped = new Map<string, YearGroup>();

  for (const row of rows) {
    const id = row.schoolYearId ?? "unknown";

    let group = grouped.get(id);
    if (!group) {
      group = {
        id,
        label: row.schoolYearLabel ?? "Other payments",
        gradeLevelName: row.gradeLevelName,
        payments: [],
        total: 0,
      };
      grouped.set(id, group);
    }

    group.payments.push(row);
    // Only posted receipts count toward money actually received.
    if (row.status === "posted") group.total += row.amount;
  }

  return Array.from(grouped.values());
}

export function PortalPaymentsView() {
  const query = usePortalPayments();
  const rows = query.data?.rows ?? [];

  if (query.isLoading) {
    return (
      <PortalPage title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <PortalSection title="Loading payments" padded={false}>
          <SkeletonTable rows={5} columns={6} />
        </PortalSection>
      </PortalPage>
    );
  }

  if (query.isError) {
    return (
      <PortalPage title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 sm:p-5"
        >
          <p className="text-sm font-medium text-destructive">
            We could not load your payment history.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            This is usually temporary. Try again in a moment.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      </PortalPage>
    );
  }

  if (rows.length === 0) {
    return (
      <PortalPage title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <EmptyState
          icon="payments"
          title="No payments yet"
          description="Your payment history will appear here once payments are posted."
        />
      </PortalPage>
    );
  }

  const schoolYears = groupBySchoolYear(rows);
  const totalPaid = schoolYears.reduce((sum, group) => sum + group.total, 0);

  return (
    <PortalPage
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      actions={
        query.isFetching ? (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Refreshing...
          </span>
        ) : null
      }
    >
      <PortalMetricGroup columns={2}>
        <PortalMetric
          label="Total paid, all school years"
          tone="positive"
          value={<CurrencyDisplay amount={totalPaid} srLabel="Total paid" />}
        />
        <PortalMetric
          label="Receipts on record"
          value={<span>{rows.length}</span>}
        />
      </PortalMetricGroup>

      {schoolYears.map((group) => (
        <PortalSection
          key={group.id}
          title={
            group.gradeLevelName
              ? `${group.gradeLevelName}, ${group.label}`
              : group.label
          }
          subtitle={
            <>
              Total paid: <CurrencyDisplay amount={group.total} />
            </>
          }
          padded={false}
        >
          <PortalRecordList
            columns={columns}
            rows={group.payments}
            getRowKey={(r) => r.id}
            caption={`Payments for ${group.label}`}
          />
        </PortalSection>
      ))}
    </PortalPage>
  );
}
