import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getRefundCutoffSettings, RefundCutoffSettingsForm } from "@/features/settings";
import { ChevronLeft, Settings } from "lucide-react";

export const metadata = {
  title: "Cancellation Settings | SRAMS",
  description: "Configure enrollment cancellation and refund settings",
};

export default async function CancellationSettingsPage() {
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
