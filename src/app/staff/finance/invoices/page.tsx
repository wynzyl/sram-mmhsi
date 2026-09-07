import { Metadata } from "next";
import { InternalInvoicesListPage } from "@/app/page-templates/invoices/invoices-index-page";

// Disable instant navigation - page has session/DB access
export const instant = false;

export const metadata: Metadata = {
  title: "Invoices | SRAMS",
};

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    gradeLevel?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function StaffInvoicesPage({ searchParams }: PageProps) {
  return (
    <InternalInvoicesListPage
      searchParams={searchParams}
      invoicesListPath="/staff/finance/invoices"
      deniedRedirect="/staff/finance"
    />
  );
}
