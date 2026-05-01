"use client";

import { useActionState, useEffect, useState } from "react";
import { sendInvoiceAction } from "@/actions/invoices";
import type { InvoiceActionState } from "@/lib/validators/invoice";

interface SendInvoiceDialogProps {
  invoiceId: string;
  defaultEmail?: string;
}

const initialState: InvoiceActionState = {};

export default function SendInvoiceDialog({ invoiceId, defaultEmail = "" }: SendInvoiceDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, action, pending] = useActionState(sendInvoiceAction, initialState);

  useEffect(() => {
    if (state.success) {
      setIsOpen(false);
    }
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setIsOpen(true)}
      >
        Send via Email
      </button>

      {isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <div className="modal-header">
              <h3 className="modal-title">Send Invoice</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form action={action}>
              <div className="modal-body">
                <input type="hidden" name="invoiceId" value={invoiceId} />

                {state.message && !state.success && (
                  <div className="alert alert-error" role="alert">
                    {state.message}
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="email" className="form-label">
                    Recipient Email <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="form-control"
                    defaultValue={defaultEmail}
                    required
                    placeholder="parent@example.com"
                  />
                  {state.errors?.email && (
                    <p className="form-error">{state.errors.email[0]}</p>
                  )}
                </div>
                
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "1rem" }}>
                  This will send the invoice details to the specified email address and update the invoice status to "SENT".
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={pending}
                >
                  {pending ? "Sending..." : "Send Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
