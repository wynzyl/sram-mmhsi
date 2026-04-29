"use client";

interface ReceiptBooklet {
  id: string;
  series: string;
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
            <th>Start Number</th>
            <th>End Number</th>
            <th>Next Available</th>
            <th>Status</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {booklets.length === 0 ? (
            <tr>
              <td colSpan={6} className="table-empty">
                No receipt booklets found.
              </td>
            </tr>
          ) : (
            booklets.map((booklet) => (
              <tr key={booklet.id} className="table-row-hover">
                <td style={{ fontWeight: 600 }}>{booklet.series}</td>
                <td>{String(booklet.startNumber).padStart(6, "0")}</td>
                <td>{String(booklet.endNumber).padStart(6, "0")}</td>
                <td style={{ color: booklet.status === "active" ? "var(--color-primary)" : "inherit" }}>
                  {booklet.status === "active" 
                    ? String(booklet.nextNumber).padStart(6, "0") 
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
