"use client";

import { generateInvoiceConfirmAction } from "../../invoices/invoices.actions";
import { ConfirmActionButton } from "@/components/shared/ConfirmActionButton";

interface GenerateInvoiceButtonProps {
  assessmentId: string;
  balance: number;
}

export default function GenerateInvoiceButton({ assessmentId, balance }: GenerateInvoiceButtonProps) {
  const isBalanceSettled = balance <= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {isBalanceSettled ? (
        <button
          type="button"
          disabled
          className="btn-secondary btn-sm"
          title="Balance already settled!"
          style={{ opacity: 0.5, cursor: "not-allowed" }}
        >
          Generate Invoice
        </button>
      ) : (
        <ConfirmActionButton
          action={generateInvoiceConfirmAction}
          confirmMessage="Generate invoice for this assessment? This creates a financial record."
          hiddenFields={{ assessmentId }}
          label="Generate Invoice"
          loadingLabel="Generating..."
          variant="secondary"
          className="btn-secondary btn-sm"
        />
      )}
    </div>
  );
}
