import { Metadata } from "next";
import { InternalInvoiceDetailPage } from "@/app/page-templates/invoices/invoice-detail-page";

export const metadata: Metadata = {
  title: "Invoice Details | SRAMS",
};

export default async function StaffInvoiceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <InternalInvoiceDetailPage
      invoiceId={params.id}
      invoicesListPath="/staff/finance/invoices"
      deniedRedirect="/staff/finance"
      assessmentsBasePath="/staff/assessments"
    />
  );
}
