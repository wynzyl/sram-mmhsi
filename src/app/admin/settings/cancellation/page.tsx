import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getRefundCutoffSettings, RefundCutoffSettingsForm } from "@/features/settings";
import { ChevronLeft, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata = {
  title: "Cancellation Settings | SRAMS",
  description: "Configure enrollment cancellation and refund settings",
};

/**
 * Instant navigation - full settings form skeleton shown while data loads.
 */
export default function CancellationSettingsPage() {
  return (
    <Suspense fallback={<CancellationSettingsSkeleton />}>
      <CancellationSettingsContent />
    </Suspense>
  );
}

function CancellationSettingsSkeleton() {
  return (
    <div className="px-8 py-6 max-w-[800px] mx-auto flex flex-col gap-6">
      {/* Back link */}
      <Skeleton className="h-5 w-48" />

      {/* Header */}
      <div>
        <Skeleton className="h-3 w-36 mb-1" />
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80 mt-1" />
      </div>

      {/* Settings Form */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="pt-2">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Additional Info */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

async function CancellationSettingsContent() {
  const session = await requireSession();

  // Only admins can access system settings
  if (!hasPermission(session.role, "system:manage")) {
    redirect("/admin/dashboard");
  }

  const settings = await getRefundCutoffSettings();

  return (
    <div className="px-8 py-6 max-w-[800px] mx-auto flex flex-col gap-6">
      {/* Back link */}
      <Link
        href="/staff/approvals?section=cancellation"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Cancellation Requests
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          <Settings className="h-3.5 w-3.5" />
          Admin · System Settings
        </div>
        <h1 className="text-2xl font-bold text-foreground">Cancellation Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure refund eligibility rules for enrollment cancellations.
        </p>
      </div>

      {/* Settings Form */}
      <RefundCutoffSettingsForm
        initialStartDate={settings.refundCutoffStartDate}
        initialCutoffDays={settings.refundCutoffDays}
      />

      {/* Additional Info */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Related Settings</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            • Fee item refundability is configured per fee type in{" "}
            <Link href="/staff/finance/fee-item-types" className="text-primary hover:underline">
              Fee Item Types
            </Link>
          </li>
          <li>
            • Cancellation requests are reviewed in{" "}
            <Link href="/staff/approvals?section=cancellation" className="text-primary hover:underline">
              Cancellation Requests
            </Link>
          </li>
          <li>
            • Outstanding balances after cancellation create{" "}
            <Link href="/staff/approvals?section=clearance" className="text-primary hover:underline">
              Clearance Records
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
