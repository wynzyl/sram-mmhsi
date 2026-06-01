"use client";

interface PrintInvoiceButtonProps {
  invoiceId: string;
}

export default function PrintInvoiceButton({ invoiceId }: PrintInvoiceButtonProps) {
  const handlePrint = () => {
    window.open(`/staff/finance/invoices/${invoiceId}/export?format=pdf`, "_blank");
  };

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={handlePrint}
      style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M4 5V2h8v3M4 11H2V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4h-2m-7 0v3h6v-3H5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Print
    </button>
  );
}
