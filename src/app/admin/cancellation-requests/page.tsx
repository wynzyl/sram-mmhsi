import { redirect } from "next/navigation";

/** Consolidated into the Approvals hub — see `/staff/approvals?section=cancellation`.
 *  Detail view remains at `/admin/cancellation-requests/[requestId]`. */
export default async function CancellationRequestsRedirectPage() {
  redirect("/staff/approvals?section=cancellation");
}
