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

const buttonClass = "inline-flex items-center justify-center gap-[0.45rem] h-[38px] min-w-[140px] px-4 bg-card text-foreground text-[13px] font-semibold tracking-[0.005em] border border-border rounded-md cursor-pointer transition-colors hover:bg-muted active:translate-y-px focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

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

  if (isDisabled) {
    return (
      <button
        type="button"
        disabled
        className={buttonClass}
        title={disabledTitle}
        style={{ opacity: 0.5, cursor: "not-allowed" }}
      >
        Generate Invoice
      </button>
    );
  }

  return (
    <ConfirmActionButton
      action={generateInvoiceConfirmAction}
      confirmMessage="Generate invoice for this assessment? This creates a financial record."
      hiddenFields={{ assessmentId }}
      label="Generate Invoice"
      loadingLabel="Generating..."
      variant="secondary"
      className={buttonClass}
    />
  );
}
