"use client";

import { generateInvoiceConfirmAction } from "@/actions/invoices";
import { ConfirmActionButton } from "@/components/shared/ConfirmActionButton";

interface GenerateInvoiceButtonProps {
  assessmentId: string;
}

export default function GenerateInvoiceButton({ assessmentId }: GenerateInvoiceButtonProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <ConfirmActionButton
        action={generateInvoiceConfirmAction}
        confirmMessage="Generate invoice for this assessment? This creates a financial record."
        hiddenFields={{ assessmentId }}
        label="Generate Invoice"
        loadingLabel="Generating..."
        variant="secondary"
        className="btn-secondary btn-sm"
      />
    </div>
  );
}
