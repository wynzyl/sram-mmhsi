import { ClipboardList, Gauge, Layers3, TriangleAlert } from "lucide-react";
import BookletForm from "@/components/finance/BookletForm";
import BookletsTable from "@/components/finance/BookletsTable";
import { receiptProgressPercent } from "@/lib/utils/receipt-theme";

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

interface ReceiptBookletManagementViewProps {
  booklets: ReceiptBooklet[];
  footerNote: string;
}

export function ReceiptBookletManagementView({
  booklets,
  footerNote,
}: ReceiptBookletManagementViewProps) {
  const activeCount = booklets.filter((b) => b.status === "active").length;
  const lowStockCount = booklets.filter(
    (b) => b.status === "active" && b.endNumber - b.nextNumber <= 10
  ).length;

  const usageRates = booklets
    .filter((b) => b.status === "active")
    .map((b) => {
      const total = b.endNumber - b.startNumber + 1;
      const consumed = Math.max(0, b.nextNumber - b.startNumber);
      return total > 0 ? (consumed / total) * 100 : 0;
    });
  const averageUsage =
    usageRates.length > 0
      ? Math.round(
          usageRates.reduce((sum, value) => sum + value, 0) / usageRates.length
        )
      : 0;
  const progress = receiptProgressPercent(averageUsage);

  return (
    <div className="ops-shell">
      <div className="ops-container">
        <div>
          <h1 className="ops-title">Receipt Booklet Management</h1>
          <p className="ops-subtitle">
            Register and oversee physical receipt booklets for institutional
            manual payment recording.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <BookletForm
            variant="dashboard"
            redirectTo="/staff/finance/booklets"
          />
          <BookletsTable booklets={booklets} variant="dashboard" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="ops-panel">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-(--color-ops-panel-muted) p-3 text-(--color-primary-300)">
                <Layers3 className="h-6 w-6" />
              </div>
              <div>
                <p className="ops-kpi-label">Total Active Booklets</p>
                <p className="ops-kpi-value">
                  {activeCount.toString().padStart(2, "0")}
                </p>
                <p className="ops-kpi-sub">Across all desks</p>
              </div>
            </div>
          </div>

          <div className="ops-panel">
            <div className="flex items-center justify-between">
              <p className="ops-kpi-label">Consumption Rate</p>
              <Gauge className="h-4 w-4 text-(--color-ops-positive)" />
            </div>
            <p className="mt-1 text-3xl font-semibold text-(--color-ops-positive)">
              {averageUsage}%
            </p>
            <div className="mt-3 h-2 rounded-full bg-(--color-ops-field)">
              <div
                className="h-2 rounded-full bg-(--color-primary-300)"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="ops-panel">
            <div className="flex items-center justify-between">
              <p className="ops-kpi-label">Low Stock Alert</p>
              <TriangleAlert className="h-4 w-4 text-(--color-ops-danger)" />
            </div>
            <p className="mt-1 text-3xl font-semibold text-(--color-ops-danger)">
              {lowStockCount.toString().padStart(2, "0")}
            </p>
            <p className="ops-kpi-sub">
              Rerender required for near-exhausted booklets
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 text-xs text-(--color-ops-muted) md:flex">
          <ClipboardList className="h-3.5 w-3.5" />
          {footerNote}
        </div>
      </div>
    </div>
  );
}
