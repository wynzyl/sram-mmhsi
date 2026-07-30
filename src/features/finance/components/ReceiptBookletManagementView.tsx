import { ClipboardList, Gauge, Layers3, TriangleAlert } from "lucide-react";
import BookletForm from "@/features/finance/components/BookletForm";
import BookletsTable from "@/features/finance/components/BookletsTable";
import { receiptProgressPercent } from "@/lib/utils/receipt-theme";

interface ReceiptBooklet {
  id: string;
  series: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  nextNumber: number;
  status: string;
  usageMode: "auto_only" | "manual_only";
  createdAt: Date;
  assignedToUsername: string | null;
}

interface ReceiptBookletManagementViewProps {
  booklets: ReceiptBooklet[];
  footerNote: string;
  cashiers?: { id: string; username: string; email: string }[];
}

export function ReceiptBookletManagementView({
  booklets,
  footerNote,
  cashiers = [],
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
    <div className="min-h-screen p-6">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Receipt Booklet Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register and oversee physical receipt booklets for institutional
            manual payment recording.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <BookletForm
            variant="dashboard"
            redirectTo="/staff/finance/booklets"
            cashiers={cashiers}
          />
          <BookletsTable booklets={booklets} variant="dashboard" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-card border border-border rounded-md p-4">
            <div className="flex-row-4">
              <div className="rounded-xl bg-primary/15 p-3 text-primary">
                <Layers3 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Active Booklets</p>
                <p className="text-3xl font-bold text-foreground">
                  {activeCount.toString().padStart(2, "0")}
                </p>
                <p className="text-helper">Across all desks</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-md p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consumption Rate</p>
              <Gauge className="h-4 w-4 text-green-500 dark:text-green-400" />
            </div>
            <p className="mt-1 text-3xl font-semibold text-green-500 dark:text-green-400">
              {averageUsage}%
            </p>
            <div className="mt-3 h-2 rounded-full bg-muted dark:bg-[#1f2328]">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-md p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Low Stock Alert</p>
              <TriangleAlert className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <p className="mt-1 text-3xl font-semibold text-red-500 dark:text-red-400">
              {lowStockCount.toString().padStart(2, "0")}
            </p>
            <p className="text-helper">
              Rerender required for near-exhausted booklets
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 text-xs text-gray-400 dark:text-gray-500 md:flex">
          <ClipboardList className="h-3.5 w-3.5" />
          {footerNote}
        </div>
      </div>
    </div>
  );
}
