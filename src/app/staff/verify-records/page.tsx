import { redirect } from "next/navigation";

/** Nav label alias: same workflow as Registrations. */
export default async function VerifyRecordsRedirectPage() {
  redirect("/staff/registrations");
}
