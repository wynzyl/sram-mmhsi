"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { usePaymentForm, type ActiveBooklet, type ManualSuggestions } from "../hooks";
import { FormField } from "@/components/forms/FormField";
import { FormActions } from "@/components/forms/FormActions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatStoredOrNumber } from "@/lib/utils/or-number";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatCurrency } from "@/lib/utils/currency";
import { CashDiscountPreviewCard } from "./CashDiscountPreviewCard";
import { Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface PostPaymentFormProps {
  studentId: string;
  assessmentId: string;
  balance: number;
  activeBooklets: ActiveBooklet[];
  onCancel?: () => void;
  /** Called after a successful post (e.g. close modal + refresh). */
  onPosted?: () => void;
  /** Default booklet ID for pre-selection (from cashier's assigned default) */
  defaultBookletId?: string | null;
  /** Manual entry suggestions for pre-filling date and OR number */
  manualSuggestions?: ManualSuggestions;
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

/**
 * Payment posting form used in modal dialogs.
 *
 * Uses the shared usePaymentForm hook for state management and
 * cash discount eligibility checking.
 */
export default function PostPaymentForm({
  studentId,
  assessmentId,
  balance,
  activeBooklets,
  onCancel,
  onPosted,
  defaultBookletId,
  manualSuggestions,
}: PostPaymentFormProps) {
  const hydrated = useHydrated();

  // Use shared payment form hook
  const form = usePaymentForm({
    assessmentId,
    balance,
    activeBooklets,
    defaultBookletId,
    manualSuggestions,
    onSuccess: onPosted,
  });

  // Success state
  if (form.state.success) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="font-display text-xl font-extrabold text-foreground">
          Payment posted
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {form.state.message}
        </p>
        {onCancel && (
          <Button type="button" variant="secondary" className="mt-4" onClick={onCancel}>
            Close
          </Button>
        )}
      </div>
    );
  }

  // Derive simple payment method for this form (doesn't use category toggle)
  const paymentMethod = form.paymentMethod;

  return (
    <form action={form.action} className="space-y-4">
      {/* Error messages */}
      {form.state.errors?._form && (
        <div
          className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {form.state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {form.state.message && !form.state.success && (
        <div
          className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {form.state.message}
        </div>
      )}

      {/* Hidden fields */}
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="idempotencyKey" value={form.idempotencyKey} />
      <input type="hidden" name="isManualEntry" value={String(form.isManualEntry)} />
      <input type="hidden" name="applyCashDiscount" value={String(form.applyCashDiscount)} />

      {/* Amount due display */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-3">
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
          Amount due (balance)
        </span>
        <span className="font-display text-lg font-black text-primary">
          <CurrencyDisplay amount={balance} />
        </span>
      </div>

      {/* Cash Discount Preview */}
      {form.cashDiscountLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Checking discount eligibility...
          </span>
        </div>
      )}

      {!form.cashDiscountLoading &&
        form.cashDiscountEligibility?.eligible &&
        form.cashDiscountEligibility.discountDetails && (
          <CashDiscountPreviewCard
            baseAmount={form.cashDiscountEligibility.discountDetails.baseAmount}
            discountValue={form.cashDiscountEligibility.discountDetails.discountValue}
            calculationType={form.cashDiscountEligibility.discountDetails.calculationType}
            baseType={form.cashDiscountEligibility.discountDetails.baseType}
            cashDiscountAmount={form.cashDiscountEligibility.discountDetails.cashDiscountAmount}
            currentBalance={form.cashDiscountEligibility.discountDetails.currentBalance}
            newBalance={form.cashDiscountEligibility.discountDetails.newBalance}
            paymentRequired={form.cashDiscountEligibility.discountDetails.paymentRequired}
            cutoffDate={form.cashDiscountEligibility.discountDetails.cutoffDate}
            isConfirmed={form.applyCashDiscount}
            onConfirm={form.handleConfirmCashDiscount}
            onDecline={form.handleDeclineCashDiscount}
            cascadePreview={form.cashDiscountEligibility.discountDetails.cascadePreview}
          />
        )}

      {/* Manual Entry Toggle */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
        <input
          type="checkbox"
          id="isManualEntryToggle"
          checked={form.isManualEntry}
          onChange={(e) => form.handleManualEntryToggle(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="isManualEntryToggle" className="text-sm font-medium">
          Manual entry (offline payment)
        </label>
      </div>

      {/* Manual Entry Fields */}
      {form.isManualEntry && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Offline Payment Details
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Payment date"
              required
              error={form.state.errors?.manualPaymentDate}
            >
              <Input
                type="date"
                id="manualPaymentDate"
                name="manualPaymentDate"
                value={form.manualPaymentDate}
                onChange={(e) => form.setManualPaymentDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                required={form.isManualEntry}
              />
            </FormField>

            <FormField
              label="OR number"
              required
              error={form.state.errors?.manualOrNumber}
              hint="Format: AK 00050"
            >
              <Input
                type="text"
                id="manualOrNumber"
                name="manualOrNumber"
                value={form.manualOrNumber}
                onChange={(e) => form.setManualOrNumber(e.target.value.toUpperCase())}
                placeholder="AK 00050"
                required={form.isManualEntry}
                className="font-mono"
              />
            </FormField>
          </div>
        </div>
      )}

      {/* OR Booklet - only show when NOT manual entry */}
      {!form.isManualEntry && (
        <FormField label="OR booklet" required error={form.state.errors?.bookletId}>
          {activeBooklets.length === 0 ? (
            <div className="cashier-pay-alert cashier-pay-alert-error" role="status">
              <p>
                No active receipt booklets. Ask Finance to activate a booklet before
                accepting payment.
              </p>
            </div>
          ) : (
            <select
              id="bookletId"
              name="bookletId"
              className="form-control"
              required
              disabled={activeBooklets.length === 0}
              value={form.selectedBookletId}
              onChange={(e) => form.setSelectedBookletId(e.target.value)}
            >
              {activeBooklets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.series} — Next OR: {formatStoredOrNumber(b.prefix, b.nextNumber)}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}

      {/* Amount and Payment Method */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label={
            form.applyCashDiscount ? "Amount to pay (before discount)" : "Amount to pay"
          }
          required
          error={form.state.errors?.amount}
          hint={
            form.applyCashDiscount && form.cashDiscountEligibility?.discountDetails
              ? `Collect: ${formatCurrency(form.cashDiscountEligibility.discountDetails.paymentRequired)}`
              : `Maximum ${formatCurrency(balance)}`
          }
        >
          <Input
            type="number"
            id="amount"
            name="amount"
            step="0.01"
            min="0.01"
            max={balance}
            value={form.amountToPay}
            onChange={(e) => {
              form.setAmountToPay(e.target.value);
              // Reset discount confirmation when amount changes
              form.setApplyCashDiscount(false);
            }}
            error={!!form.state.errors?.amount}
            required
            className={`font-mono text-base ${form.applyCashDiscount ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
          />
        </FormField>

        <FormField label="Payment method" required error={form.state.errors?.paymentMethod}>
          <select
            id="paymentMethod"
            name="paymentMethod"
            className="form-control"
            required
            value={paymentMethod}
            onChange={(e) => {
              // Map simple method to category for consistency
              const method = e.target.value as typeof paymentMethod;
              if (method === "cash") form.setPaymentMethodCategory("CASH");
              else if (method === "check") form.setPaymentMethodCategory("CHECK");
              else {
                form.setPaymentMethodCategory("ONLINE");
                form.setOnlineMethod(method as "bank_transfer" | "gcash" | "other");
              }
            }}
          >
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="gcash">GCash</option>
            <option value="other">Other</option>
          </select>
        </FormField>
      </div>

      {/* Cash payment fields */}
      {paymentMethod === "cash" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Amount tendered"
              required
              error={form.state.errors?.amountTendered}
              hint={
                form.applyCashDiscount && form.cashDiscountEligibility?.discountDetails
                  ? `Cash received · at least ${formatCurrency(form.cashDiscountEligibility.discountDetails.paymentRequired)}`
                  : "Cash received · must be at least the amount to pay"
              }
            >
              <Input
                type="number"
                id="amountTendered"
                name="amountTendered"
                step="0.01"
                min="0"
                value={form.amountTendered}
                onChange={(e) => form.setAmountTendered(e.target.value)}
                error={!!form.state.errors?.amountTendered}
                className="font-mono text-base"
                autoComplete="off"
              />
            </FormField>
            <div className="rounded-lg border border-border bg-muted px-4 py-3">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Change
              </span>
              <span className="mt-2 block font-mono text-lg font-semibold text-foreground">
                {form.payNum > 0 && form.tenderNum >= form.payNum ? (
                  <CurrencyDisplay amount={form.change} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Reference number */}
      <FormField
        label="Reference no."
        required={paymentMethod === "gcash" || paymentMethod === "bank_transfer"}
        error={form.state.errors?.referenceNumber}
        hint={
          paymentMethod === "gcash" || paymentMethod === "bank_transfer"
            ? "GCash / bank transfer reference is required and must be unique — not used on any other payment."
            : "Required for GCash and bank transfer. If you enter a reference for other methods, it must still be unique across all payments."
        }
      >
        <Input
          type="text"
          id="referenceNumber"
          name="referenceNumber"
          placeholder={
            paymentMethod === "gcash" || paymentMethod === "bank_transfer"
              ? "Transaction reference"
              : "Check no., ref no., etc."
          }
          required={paymentMethod === "gcash" || paymentMethod === "bank_transfer"}
          error={!!form.state.errors?.referenceNumber}
          className="font-mono text-sm"
        />
      </FormField>

      {/* Remarks */}
      <FormField label="Remarks">
        <Input type="text" id="remarks" name="remarks" placeholder="Optional" />
      </FormField>

      {/* Form actions */}
      <FormActions
        submitLabel={form.pending ? "Posting…" : "Post payment & print OR"}
        cancelLabel="Cancel"
        onCancel={onCancel}
        loading={form.pending}
        // !hydrated: block pre-hydration submits (full-page POST fallback) on
        // this financial form — see useHydrated (audit finding F6).
        // Allow posting when manual entry is enabled (doesn't need active booklets).
        submitDisabled={(!form.isManualEntry && activeBooklets.length === 0) || !hydrated}
      />
    </form>
  );
}
