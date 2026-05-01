"use client";

import { formatStoredOrNumber, orNumberPadWidth } from "@/lib/utils/or-number";

interface ReceiptBooklet {
  id: string;
  series: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  nextNumber: number;
  status: string;
  createdAt: Date;
}

interface BookletsTableProps {
  booklets: ReceiptBooklet[];
}

export default function BookletsTable({ booklets }: BookletsTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "badge-success";
      case "exhausted":
        return "badge-secondary";
      case "voided":
        return "badge-danger";
      default:
        return "badge-secondary";
    }
  };

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Series</th>
            <th>OR prefix</th>
            <th>Start Number</th>
            <th>End Number</th>
            <th>Next OR</th>
            <th>Status</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {booklets.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-empty">
                No receipt booklets found.
              </td>
            </tr>
          ) : (
            booklets.map((booklet) => {
              const w = orNumberPadWidth(booklet.endNumber);
              return (
              <tr key={booklet.id} className="table-row-hover">
                <td style={{ fontWeight: 600 }}>{booklet.series}</td>
                <td style={{ fontWeight: 600 }}>{booklet.prefix}</td>
                <td style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                  {String(booklet.startNumber).padStart(w, "0")}
                </td>
                <td style={{ fontFamily: "var(--font-mono, ui-monospace)" }}>
                  {String(booklet.endNumber).padStart(w, "0")}
                </td>
                <td style={{ color: booklet.status === "active" ? "var(--color-primary)" : "inherit", fontFamily: "var(--font-mono, ui-monospace)" }}>
                  {booklet.status === "active"
                    ? formatStoredOrNumber(booklet.prefix, booklet.nextNumber, booklet.endNumber)
                    : "—"}
                </td>
                <td>
                  <span className={`badge ${getStatusBadge(booklet.status)}`}>
                    {booklet.status.charAt(0).toUpperCase() + booklet.status.slice(1)}
                  </span>
                </td>
                <td className="text-muted">
                  {booklet.createdAt.toLocaleDateString()}
                </td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
