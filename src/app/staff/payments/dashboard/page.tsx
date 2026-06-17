import { redirect } from "next/navigation";

/** The cashier landing is now the live payment queue itself — this menu page was
 *  redundant. Kept as a redirect for existing bookmarks. */
export default async function CashierDashboardRedirectPage() {
  redirect("/staff/payments");
}
