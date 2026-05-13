"use client";

import { useActionState, useEffect, useState } from "react";
import { Mail, AlertCircle } from "lucide-react";
import { sendInvoiceAction } from "../../invoices/invoices.actions";
import type { InvoiceActionState } from "../../invoices/invoices.schema";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    if (state.success) {
      setIsOpen(false);
    }
  }, [state.success]);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="primary">
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          Send via Email
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-neutral-900 dark:text-foreground">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            Send Invoice
          </AlertDialogTitle>
          <AlertDialogDescription className="text-neutral-700 dark:text-muted-foreground">
            Send the invoice details to the recipient. The invoice status will
            be updated to <span className="font-semibold text-neutral-900 dark:text-foreground">SENT</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="invoiceId" value={invoiceId} />

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
              className="block text-sm font-medium text-neutral-900 dark:text-foreground"
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-neutral-900 shadow-sm transition-colors placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:text-foreground dark:placeholder:text-muted-foreground"
            />
            {state.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email[0]}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Sending..." : "Send Invoice"}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
