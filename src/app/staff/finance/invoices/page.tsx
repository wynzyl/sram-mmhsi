import { Metadata } from "next";
import { InternalInvoicesListPage } from "@/app/page-templates/invoices/invoices-index-page";

export const metadata: Metadata = {
  title: "Invoices | SRAMS",
};

export default async function StaffInvoicesPage() {
  return (
    <InternalInvoicesListPage invoicesListPath="/staff/finance/invoices" deniedRedirect="/staff/finance" />
  );
}
