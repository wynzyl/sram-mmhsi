import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { PortalPaymentsView } from "@/features/payments/components/PortalPaymentsView";

export const metadata = { title: "My Payments" };

/**
 * Thin server shell: enforces auth + portal session, then renders the client view.
 * Payment history is fetched client-side via `usePortalPayments` (TanStack Query)
 * — always-fresh, never cached server-side.
 * The API route uses session.studentId directly for secure data access.
 */
export default async function PortalPaymentsPage() {
  const session = await requireSession();

  // Only allow portal sessions
  if (session.accountSource !== "portal" || !session.studentId) {
    redirect("/login");
  }

  return <PortalPaymentsView />;
}
