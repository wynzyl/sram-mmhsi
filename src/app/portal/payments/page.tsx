import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { PORTAL_ROLES } from "@/lib/constants/roles";
import { PortalPaymentsView } from "@/features/payments/components/PortalPaymentsView";

export const metadata = { title: "My Payments" };

/**
 * Thin server shell: enforces auth + portal role, then renders the client view.
 * Payment history is fetched client-side via `usePortalPayments` (TanStack Query)
 * — always-fresh, never cached server-side.
 */
export default async function PortalPaymentsPage() {
  const session = await requireSession();

  if (!PORTAL_ROLES.includes(session.role)) {
    redirect("/login");
  }

  return <PortalPaymentsView />;
}
