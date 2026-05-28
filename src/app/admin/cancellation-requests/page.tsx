import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getCancellationRequests } from "@/features/enrollments/enrollment-cancellation.queries";
import CancellationRequestsTable from "@/features/enrollments/components/CancellationRequestsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, XCircle, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cancellation Requests" };

export default async function CancellationRequestsPage() {
  const session = await requireSession();

  // Only admin/super_admin can access
  if (!["admin", "super_admin"].includes(session.role)) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="font-display text-xl font-bold text-foreground">
            Access Denied
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Only administrators can access cancellation requests.
          </p>
        </header>
      </div>
    );
  }

  // Fetch requests for different statuses
  const [pendingResult, allResult] = await Promise.all([
    getCancellationRequests({ page: 1, pageSize: 100 }, { status: "pending" }),
    getCancellationRequests({ page: 1, pageSize: 100 }),
  ]);

  const pendingRequests = pendingResult.data;
  const allRequests = allResult.data;

  const approvedCount = allRequests.filter((r) => r.status === "approved").length;
  const rejectedCount = allRequests.filter((r) => r.status === "rejected").length;
  const cancelledCount = allRequests.filter((r) => r.status === "cancelled").length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Enrollment Cancellation Requests
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review and process enrollment cancellation requests
          </p>
        </div>
        <Link href="/admin/settings/cancellation">
          <Button variant="secondary" size="sm">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className={pendingRequests.length > 0 ? "border-amber-200 bg-amber-50/30" : ""}>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-amber-100 p-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {pendingRequests.length}
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
                {approvedCount}
              </p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-red-100 p-2">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {rejectedCount}
              </p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-gray-100 p-2">
              <AlertTriangle className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">
                {cancelledCount}
              </p>
              <p className="text-xs text-muted-foreground">Withdrawn</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">
                {pendingRequests.length} request{pendingRequests.length > 1 ? "s" : ""} awaiting review
              </p>
              <p className="mt-1 text-sm text-amber-700">
                These students cannot make financial transactions until their requests are processed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {allRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cancellation requests found.
            </p>
          ) : (
            <CancellationRequestsTable
              requests={allRequests}
              showActions={true}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
