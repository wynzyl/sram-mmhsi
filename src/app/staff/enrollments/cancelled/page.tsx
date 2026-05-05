import { redirect } from "next/navigation";

export default async function StaffCancelledEnrollmentsRedirectPage() {
  redirect("/staff/enrollments?status=cancelled");
}
