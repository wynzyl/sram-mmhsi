import { requirePortalSession } from "@/lib/auth/session";
import { PortalPaymentsView } from "@/features/payments/components/PortalPaymentsView";

export const metadata = { title: "My Payments" };

/**
 * Thin server shell: enforces auth + portal session, then renders the client view.
 * Payment history is fetched client-side via `usePortalPayments` (TanStack Query)
 * Always fresh, never cached server-side.
 * The API route uses session.studentId directly for secure data access.
 */
export default async function PortalPaymentsPage() {
  await requirePortalSession();

  return <PortalPaymentsView />;
}
