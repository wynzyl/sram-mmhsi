import { redirect } from "next/navigation";

/** Consolidated into the Approvals hub — see `/staff/approvals?section=discount`. */
export default async function DiscountRequestsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(`/staff/approvals?section=discount${tab ? `&tab=${tab}` : ""}`);
}
