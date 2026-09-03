import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ clearanceId: string }>;
}

/**
 * Admin clearance detail page redirects to staff route.
 * The clearance detail page is now at /staff/clearances/[clearanceId]
 * which properly handles permission checks for all staff roles.
 */
export default async function ClearanceDetailPage({ params }: PageProps) {
  const { clearanceId } = await params;
  redirect(`/staff/clearances/${clearanceId}`);
}
