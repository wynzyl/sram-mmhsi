"use client";

import { Button } from "@/components/ui/button";

interface PaymentCollectionReportActionsProps {
  startDate: string;
  endDate: string;
  schoolYearId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}

export function PaymentCollectionReportActions({
  startDate,
  endDate,
  schoolYearId,
  paymentMethod,
  paymentStatus,
}: PaymentCollectionReportActionsProps) {
  const handlePrint = () => {
    // Build query params for print page
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);

    // Open print page in new window
    window.open(
      `/staff/reports/payment-collection/print?${params.toString()}`,
      "_blank"
    );
  };

  return (
    <div className="flex items-center gap-3 no-print">
      <Button type="button" variant="secondary" onClick={handlePrint}>
        <svg
          className="w-4 h-4 mr-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Print
      </Button>
    </div>
  );
}
