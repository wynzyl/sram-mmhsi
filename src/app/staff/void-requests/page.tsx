import { redirect } from "next/navigation";

/** Consolidated into the Approvals hub — see `/staff/approvals?section=void`. */
export default async function VoidRequestsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(`/staff/approvals?section=void${tab ? `&tab=${tab}` : ""}`);
}
