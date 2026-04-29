"use client";

import Link from "next/link";

interface FeeSchedule {
  id: string;
  schoolYear: string;
  gradeLevel: string;
  description: string | null;
  isActive: boolean;
  itemCount: number;
  totalAmount: number;
}

interface FeeSchedulesTableProps {
  schedules: FeeSchedule[];
  canManage: boolean;
}

export default function FeeSchedulesTable({
  schedules,
  canManage,
}: FeeSchedulesTableProps) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>School Year</th>
            <th>Grade Level</th>
            <th>Description</th>
            <th>Items</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedules.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-empty">
                No fee schedules found.
              </td>
            </tr>
          ) : (
            schedules.map((schedule) => (
              <tr key={schedule.id} className="table-row-hover">
                <td>{schedule.schoolYear}</td>
                <td>{schedule.gradeLevel}</td>
                <td>{schedule.description || "—"}</td>
                <td>{schedule.itemCount}</td>
                <td style={{ fontWeight: 500 }}>
                  ₱{schedule.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td>
                  <span
                    className={`badge ${
                      schedule.isActive ? "badge-success" : "badge-secondary"
                    }`}
                  >
                    {schedule.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/admin/finance/fee-schedules/${schedule.id}`}
                    className="table-action-link"
                  >
                    View / Edit
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
