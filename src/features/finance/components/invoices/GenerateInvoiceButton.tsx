"use client";

import { generateInvoiceConfirmAction } from "../../invoices/invoices.actions";
import { ConfirmActionButton } from "@/components/shared/ConfirmActionButton";

interface GenerateInvoiceButtonProps {
  assessmentId: string;
  balance: number;
  /** Disable the button with a custom reason tooltip */
  disabled?: boolean;
  disabledReason?: string;
}

export default function GenerateInvoiceButton({
  assessmentId,
  balance,
  disabled = false,
  disabledReason,
}: GenerateInvoiceButtonProps) {
  const isBalanceSettled = balance <= 0;
  const isDisabled = disabled || isBalanceSettled;
  const disabledTitle = disabled
    ? disabledReason ?? "Invoice generation not available"
    : "Balance already settled!";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {isDisabled ? (
        <button
          type="button"
          disabled
          className="btn-secondary btn-sm"
          title={disabledTitle}
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
