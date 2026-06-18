import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getClearances, getClearanceCounters } from "@/features/clearances/clearances.queries";
import ClearanceTable from "@/features/clearances/components/ClearanceTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Clock, CheckCircle, FileText, AlertTriangle } from "lucide-react";

/**
 * Student Clearances queue — extracted verbatim from the former `/admin/clearances`
 * page so it can render as the "Clearance" section of the Approvals hub. The
 * permission gate and detail links are unchanged.
 */
export default async function ClearancesView() {
  const session = await requireSession();

  if (!hasPermission(session.role, "clearances:read")) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="font-display text-lg font-bold text-foreground">Access Denied</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            You do not have permission to view clearances.
          </p>
        </header>
      </div>
    );
  }

  const [counters, allResult] = await Promise.all([
    getClearanceCounters(),
    getClearances({ page: 1, pageSize: 100 }),
  ]);

  const allClearances = allResult.data;
  const pendingCount = counters.pendingCount;
  const clearedCount = counters.clearedCount;
  const waivedCount = counters.waivedCount;
  const totalOutstanding = counters.totalPendingOutstanding;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Student Clearances
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage clearance records and outstanding balances
          </p>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className={pendingCount > 0 ? "border-amber-200 bg-amber-50/30" : ""}>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-amber-100 p-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {pendingCount}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-green-100 p-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {clearedCount}
              </p>
              <p className="text-xs text-muted-foreground">Cleared</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-blue-100 p-2">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {waivedCount}
              </p>
              <p className="text-xs text-muted-foreground">Waived</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-red-100 p-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">
                <CurrencyDisplay amount={totalOutstanding} />
              </p>
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Clearances Alert */}
      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">
                {pendingCount} student{pendingCount > 1 ? "s have" : " has"} pending clearances
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Total outstanding: <CurrencyDisplay amount={totalOutstanding} className="font-semibold" />.
                Document requests are blocked until clearances are resolved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clearances Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Clearances</CardTitle>
        </CardHeader>
        <CardContent>
          {allClearances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clearance records found.
            </p>
          ) : (
            <ClearanceTable
              clearances={allClearances}
              showActions={true}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
