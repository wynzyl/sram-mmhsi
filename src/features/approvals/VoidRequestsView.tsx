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

/**
 * Void Requests queue — extracted verbatim from the former `/staff/void-requests`
 * page so it can render as the "Void" section of the Approvals hub. Only the inner
 * tab links were repointed to `/staff/approvals?section=void`.
 */
export default async function VoidRequestsView({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const canApprove = hasPermission(session.role, "payments:void_approve");

  const tab = params.tab === "history" ? "history" : "pending";

  // Admin view: sees all requests and can approve/reject
  // Cashier view: sees only their own requests
  const isAdminView = canApprove;

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
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          {isAdminView ? "Void Requests" : "My Void Requests"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAdminView
            ? "Review and process payment void requests from cashiers and registrars"
            : "Track your submitted void requests and their approval status"}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex gap-1 border-b border-border" aria-label="Void request tabs">
          <a
            href="/staff/approvals?section=void&tab=pending"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "pending"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
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
            href="/staff/approvals?section=void&tab=history"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            History
          </a>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border border-border">
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
