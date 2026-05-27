import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import { CashierDashboardView } from "@/features/payments/components/CashierDashboardView";

/**
 * Thin server shell: enforces auth + read permission, then renders the client
 * cashier dashboard. Stats, queue, and recent collections are fetched client-side
 * via `useCashierQueue` (TanStack Query) — always-fresh financial data, polled
 * every 30s, never cached server-side.
 */
export default async function CashierQueuePage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "payments:read")) {
    redirect("/login");
  }

  return <CashierDashboardView />;
}
