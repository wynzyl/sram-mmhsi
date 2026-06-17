import { redirect } from "next/navigation";

/** Consolidated into the Approvals hub — see `/staff/approvals?section=clearance`.
 *  Detail view remains at `/admin/clearances/[clearanceId]`. */
export default async function ClearancesRedirectPage() {
  redirect("/staff/approvals?section=clearance");
}
