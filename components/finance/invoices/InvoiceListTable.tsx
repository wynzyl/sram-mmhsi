"use client";

import Link from "next/link";

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  studentName: string;
  amountDue: number;
  status: "draft" | "sent" | "viewed" | "settled" | "overdue";
  dueDate: Date | null;
  createdAt: Date;
}

interface InvoiceListTableProps {
  invoices: InvoiceData[];
  /** Base path without trailing slash; detail links append `/${invoice.id}`. */
  invoiceDetailBasePath?: string;
}

export default function InvoiceListTable({
  invoices,
  invoiceDetailBasePath = "/staff/finance/invoices",
}: InvoiceListTableProps) {
  const normalizedBasePath =
    invoiceDetailBasePath.replace(/\/+$/, "") || "/staff/finance/invoices";

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice Number</th>
            <th>Student</th>
            <th>Amount Due</th>
            <th>Status</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={6} className="table-empty">
                No invoices found.
              </td>
            </tr>
          ) : (
            invoices.map((invoice) => (
              <tr key={invoice.id} className="table-row-hover">
                <td style={{ fontWeight: 500 }}>{invoice.invoiceNumber}</td>
                <td>{invoice.studentName}</td>
                <td style={{ fontWeight: 500 }}>
                  ₱{Number(invoice.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td>
                  <span
                    className={`badge ${
                      invoice.status === "settled"
                        ? "badge-success"
                        : invoice.status === "sent" || invoice.status === "viewed"
                        ? "badge-primary"
                        : invoice.status === "overdue"
                        ? "badge-error"
                        : "badge-secondary"
                    }`}
                  >
                    {invoice.status.toUpperCase()}
                  </span>
                </td>
                <td>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                <td>
                  <Link
                    href={`${normalizedBasePath}/${invoice.id}`}
                    className="table-action-link"
                  >
                    View Details
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
