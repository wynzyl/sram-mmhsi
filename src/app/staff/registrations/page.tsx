import type { Metadata } from "next";
import { RegistrationQueuePage } from "@/app/page-templates/registrations/registration-queue-page";

export const metadata: Metadata = {
  title: "Registrations",
  description: "View student registrations (staff).",
};

export default async function StaffRegistrationsPage(props: {
  searchParams: Promise<{ page?: string; schoolYearId?: string }>;
}) {
  return (
    <RegistrationQueuePage
      searchParams={props.searchParams}
      pathPrefix="/staff"
      deniedRedirect="/staff/dashboard"
    />
  );
}
