"use client";

import { useActionState, useState, useCallback, useEffect } from "react";
import { Mail, AlertCircle } from "lucide-react";
import { sendInvoiceAction } from "../../invoices/invoices.actions";
import type { InvoiceActionState } from "../../invoices/invoices.schema";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { useFormToast } from "@/hooks/useFormToast";
import { generateUuid } from "@/lib/utils/uuid";

interface SendInvoiceDialogProps {
  invoiceId: string;
  defaultEmail?: string;
}

const initialState: InvoiceActionState = {};

export default function SendInvoiceDialog({
  invoiceId,
  defaultEmail = "",
}: SendInvoiceDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, action, pending] = useActionState(sendInvoiceAction, initialState);
  // Unique idempotency key per dialog mount. Generated in an effect because
  // it is impure (crypto/random) and must not be called during render or SSR --
  // server-rendering it would also cause a hydration mismatch.
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => {
    // One-time client-only initialization: legitimate setState-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdempotencyKey(generateUuid());
  }, []);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  useFormToast(state, {
    successMessage: "Invoice sent successfully",
    onSuccess: closeModal,
  });

  return (
    <>
      <Button type="button" variant="primary" onClick={openModal}>
        <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
        Send via Email
      </Button>

      <Modal
        open={isOpen}
        onClose={closeModal}
        size="sm"
        aria-labelledby="send-invoice-title"
        aria-describedby="send-invoice-description"
      >
        <ModalHeader onClose={closeModal} kicker="Finance · Invoices">
          <h2 id="send-invoice-title" className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            Send Invoice
          </h2>
        </ModalHeader>

        <ModalBody>
          <p id="send-invoice-description" className="text-sm text-muted-foreground mb-4">
            Send the invoice details to the recipient. The invoice status will
            be updated to <span className="font-semibold text-foreground">SENT</span>.
          </p>

          <form action={action} className="space-y-4">
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

            {state.message && !state.success && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{state.message}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Recipient Email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                defaultValue={defaultEmail}
                required
                placeholder="parent@example.com"
                autoComplete="email"
                disabled={pending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              {state.errors?.email && (
                <p className="text-xs text-destructive">{state.errors.email[0]}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModal}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Sending..." : "Send Invoice"}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </>
  );
}
