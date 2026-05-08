import { redirect } from "next/navigation";

/** Legacy path used in bookmarks / older nav — canonical route is `/staff/finance/invoices`. */
export default function StaffInvoicesRedirectPage() {
  redirect("/staff/finance/invoices");
}
