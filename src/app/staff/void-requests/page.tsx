import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  listPendingVoidRequests,
  listVoidRequestHistory,
  listMyPendingVoidRequests,
  listMyVoidRequestHistory,
} from "@/features/payments/void-requests.queries";
import VoidRequestsPendingTable from "@/features/payments/components/VoidRequestsPendingTable";
import VoidRequestsHistoryTable from "@/features/payments/components/VoidRequestsHistoryTable";
import MyVoidRequestsTable from "@/features/payments/components/MyVoidRequestsTable";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function VoidRequestsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;

  // Users need either void_request (to see their own) or void_approve (to manage all)
  const canRequest = hasPermission(session.role, "payments:void_request");
  const canApprove = hasPermission(session.role, "payments:void_approve");

  if (!canRequest && !canApprove) {
    redirect("/staff");
  }

  const tab = params.tab === "history" ? "history" : "pending";

  // Admin view: sees all requests and can approve/reject
  // Cashier view: sees only their own requests
  const isAdminView = canApprove;

  // Fetch data based on view type and active tab
  let pendingRequests: Awaited<ReturnType<typeof listPendingVoidRequests>> = [];
  let historyRequests: Awaited<ReturnType<typeof listVoidRequestHistory>> = [];

  if (tab === "pending") {
    pendingRequests = isAdminView
      ? await listPendingVoidRequests()
      : await listMyPendingVoidRequests(session.userId);
  } else {
    historyRequests = isAdminView
      ? await listVoidRequestHistory({ limit: 100 })
      : await listMyVoidRequestHistory(session.userId, { limit: 100 });
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            {isAdminView ? "Void Requests" : "My Void Requests"}
          </h1>
          <p className="page-subtitle">
            {isAdminView
              ? "Review and process payment void requests from cashiers and registrars"
              : "Track your submitted void requests and their approval status"}
          </p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex gap-1 border-b border-[var(--color-border)]" aria-label="Tabs">
          <a
            href="/staff/void-requests?tab=pending"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "pending"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]"
            }`}
          >
            {isAdminView ? "Pending" : "Awaiting Approval"}
            {pendingRequests.length > 0 && tab === "pending" && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                {pendingRequests.length}
              </span>
            )}
          </a>
          <a
            href="/staff/void-requests?tab=history"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "history"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]"
            }`}
          >
            History
          </a>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        {tab === "pending" ? (
          isAdminView ? (
            <VoidRequestsPendingTable
              requests={pendingRequests}
              currentUserId={session.userId}
            />
          ) : (
            <MyVoidRequestsTable requests={pendingRequests} />
          )
        ) : (
          <VoidRequestsHistoryTable requests={historyRequests} />
        )}
      </div>
    </div>
  );
}
