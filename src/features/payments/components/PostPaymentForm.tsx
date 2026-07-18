"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { postPaymentAction } from "../payments.actions";
import type { PaymentFormState } from "../payments.schema";
import type { CashDiscountEligibility } from "../payments.queries";
import { FormField } from "@/components/forms/FormField";
import { FormActions } from "@/components/forms/FormActions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatStoredOrNumber } from "@/lib/utils/or-number";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatCurrency, roundToTwoDecimals } from "@/lib/utils/currency";
import { generateUuid } from "@/lib/utils/uuid";
import { CashDiscountPreviewCard } from "./CashDiscountPreviewCard";
import { Loader2 } from "lucide-react";

type PaymentMethod = "cash" | "check" | "bank_transfer" | "gcash" | "other";

interface PostPaymentFormProps {
  studentId: string;
  assessmentId: string;
  balance: number;
  activeBooklets: {
    id: string;
    series: string;
    prefix: string;
    nextNumber: number;
    endNumber: number;
  }[];
  onCancel?: () => void;
  /** Called after a successful post (e.g. close modal + refresh). */
  onPosted?: () => void;
  /** Default booklet ID for pre-selection (from cashier's assigned default) */
  defaultBookletId?: string | null;
  /** Manual entry suggestions for pre-filling date and OR number */
  manualSuggestions?: {
    lastManualPaymentDate: string | null;
    suggestedOrNumbers: { bookletId: string; series: string; nextOr: string }[];
  };
}


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
  const initialState: PaymentFormState = {};
  const [state, action, pending] = useActionState(postPaymentAction, initialState);
  const hydrated = useHydrated();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountToPay, setAmountToPay] = useState(String(balance));
  const [amountTendered, setAmountTendered] = useState("");

  // Default booklet selection (pre-select if valid and in activeBooklets)
  const [selectedBookletId, setSelectedBookletId] = useState<string>(() => {
    if (defaultBookletId && activeBooklets.some(b => b.id === defaultBookletId)) {
      return defaultBookletId;
    }
    return activeBooklets[0]?.id ?? "";
  });

  // Manual entry state
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualPaymentDate, setManualPaymentDate] = useState("");
  const [manualOrNumber, setManualOrNumber] = useState("");

  // Cash discount eligibility state
  const [cashDiscountEligibility, setCashDiscountEligibility] = useState<CashDiscountEligibility | null>(null);
  const [cashDiscountLoading, setCashDiscountLoading] = useState(false);
  const [applyCashDiscount, setApplyCashDiscount] = useState(false);

  // Handler for toggling manual entry - auto-fills suggestions on first enable
  const handleManualEntryToggle = (checked: boolean) => {
    setIsManualEntry(checked);
    // Auto-fill suggestions when enabling manual entry (only if fields are empty)
    if (checked && manualSuggestions) {
      if (manualSuggestions.lastManualPaymentDate && !manualPaymentDate) {
        setManualPaymentDate(manualSuggestions.lastManualPaymentDate);
      }
      if (manualSuggestions.suggestedOrNumbers[0] && !manualOrNumber) {
        setManualOrNumber(manualSuggestions.suggestedOrNumbers[0].nextOr);
      }
    }
  };

  // One key per form mount: a retried submit replays as the SAME payment
  // server-side instead of consuming a second OR (audit finding F7).
  // Generated after mount — an SSR-generated UUID would differ from the
  // client render and cause a hydration mismatch on the hidden input.
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => {
    // One-time client-only initialization: legitimate setState-in-effect —
    // the UUID must not be SSR-rendered or hydration would mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdempotencyKey(generateUuid());
  }, []);

  useEffect(() => {
    if (state.success && onPosted) {
      const t = window.setTimeout(() => onPosted(), 1600);
      return () => window.clearTimeout(t);
    }
  }, [state.success, onPosted]);

  // Check cash discount eligibility when amount equals or exceeds balance
  const checkCashDiscountEligibility = useCallback(async () => {
    // Skip eligibility check if discount is already confirmed
    // (the user manually updates amount via onConfirm/onDecline, not this check)
    if (applyCashDiscount) {
      return;
    }

    const payNum = parseFloat(amountToPay);
    const EPSILON = 0.01;

    // Only check if amount is approximately equal to or exceeds balance
    if (isNaN(payNum) || payNum < balance - EPSILON) {
      setCashDiscountEligibility(null);
      return;
    }

    setCashDiscountLoading(true);
    try {
      const response = await fetch(
        `/api/cashier/cash-discount?assessmentId=${assessmentId}&amount=${payNum}`
      );
      if (response.ok) {
        const data = await response.json();
        // Parse cutoff date back from ISO string
        if (data.discountDetails?.cutoffDate) {
          data.discountDetails.cutoffDate = new Date(data.discountDetails.cutoffDate);
        }
        setCashDiscountEligibility(data);
      } else {
        setCashDiscountEligibility(null);
      }
    } catch {
      setCashDiscountEligibility(null);
    } finally {
      setCashDiscountLoading(false);
    }
  }, [amountToPay, balance, assessmentId, applyCashDiscount]);

  // Debounced eligibility check on amount change
  useEffect(() => {
    const timer = setTimeout(() => {
      checkCashDiscountEligibility();
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [checkCashDiscountEligibility]);

  // Determine effective payment amount (reduced if cash discount applies)
  const rawPayNum = Number.parseFloat(amountToPay) || 0;
  const effectivePayNum =
    applyCashDiscount && cashDiscountEligibility?.discountDetails
      ? cashDiscountEligibility.discountDetails.paymentRequired
      : rawPayNum;
  const payNum = effectivePayNum;
  const tenderNum = Number.parseFloat(amountTendered) || 0;
  const change =
    paymentMethod === "cash" && tenderNum >= payNum && payNum > 0
      ? roundToTwoDecimals(tenderNum - payNum)
      : 0;

  if (state.success) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="font-display text-xl font-extrabold text-foreground">Payment posted</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{state.message}</p>
        {onCancel && (
          <Button type="button" variant="secondary" className="mt-4" onClick={onCancel}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.errors?._form && (
        <div
          className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && !state.success && (
        <div
          className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.message}
        </div>
      )}

      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="isManualEntry" value={String(isManualEntry)} />
      <input type="hidden" name="applyCashDiscount" value={String(applyCashDiscount)} />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-3">
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Amount due (balance)</span>
        <span className="font-display text-lg font-black text-primary">
          <CurrencyDisplay amount={balance} />
        </span>
      </div>

      {/* Cash Discount Preview */}
      {cashDiscountLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Checking discount eligibility...</span>
        </div>
      )}

      {!cashDiscountLoading && cashDiscountEligibility?.eligible && cashDiscountEligibility.discountDetails && (
        <CashDiscountPreviewCard
          baseAmount={cashDiscountEligibility.discountDetails.baseAmount}
          discountValue={cashDiscountEligibility.discountDetails.discountValue}
          calculationType={cashDiscountEligibility.discountDetails.calculationType}
          baseType={cashDiscountEligibility.discountDetails.baseType}
          cashDiscountAmount={cashDiscountEligibility.discountDetails.cashDiscountAmount}
          currentBalance={cashDiscountEligibility.discountDetails.currentBalance}
          newBalance={cashDiscountEligibility.discountDetails.newBalance}
          paymentRequired={cashDiscountEligibility.discountDetails.paymentRequired}
          cutoffDate={cashDiscountEligibility.discountDetails.cutoffDate}
          isConfirmed={applyCashDiscount}
          onConfirm={() => {
            setApplyCashDiscount(true);
            // Update the amount to pay field to the discounted amount
            if (cashDiscountEligibility?.discountDetails) {
              setAmountToPay(String(cashDiscountEligibility.discountDetails.paymentRequired));
            }
          }}
          onDecline={() => {
            setApplyCashDiscount(false);
            // Restore the original balance
            setAmountToPay(String(balance));
          }}
        />
      )}

      {/* Manual Entry Toggle */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
        <input
          type="checkbox"
          id="isManualEntryToggle"
          checked={isManualEntry}
          onChange={(e) => handleManualEntryToggle(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="isManualEntryToggle" className="text-sm font-medium">
          Manual entry (offline payment)
        </label>
      </div>

      {/* Manual Entry Fields */}
      {isManualEntry && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Offline Payment Details
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Payment date"
              required
              error={state.errors?.manualPaymentDate}
            >
              <Input
                type="date"
                id="manualPaymentDate"
                name="manualPaymentDate"
                value={manualPaymentDate}
                onChange={(e) => setManualPaymentDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                required={isManualEntry}
              />
            </FormField>

            <FormField
              label="OR number"
              required
              error={state.errors?.manualOrNumber}
              hint="Format: AK 00050"
            >
              <Input
                type="text"
                id="manualOrNumber"
                name="manualOrNumber"
                value={manualOrNumber}
                onChange={(e) => setManualOrNumber(e.target.value.toUpperCase())}
                placeholder="AK 00050"
                required={isManualEntry}
                className="font-mono"
              />
            </FormField>
          </div>
        </div>
      )}

      {/* OR Booklet - only show when NOT manual entry */}
      {!isManualEntry && (
        <FormField label="OR booklet" required error={state.errors?.bookletId}>
          {activeBooklets.length === 0 ? (
            <div className="cashier-pay-alert cashier-pay-alert-error" role="status">
              <p>
                No active receipt booklets. Ask Finance to activate a booklet before accepting
                payment.
              </p>
            </div>
          ) : (
            <select
              id="bookletId"
              name="bookletId"
              className="form-control"
              required
              disabled={activeBooklets.length === 0}
              value={selectedBookletId}
              onChange={(e) => setSelectedBookletId(e.target.value)}
            >
              {activeBooklets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.series} — Next OR:{" "}
                  {formatStoredOrNumber(b.prefix, b.nextNumber)}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label={applyCashDiscount ? "Amount to pay (before discount)" : "Amount to pay"}
          required
          error={state.errors?.amount}
          hint={
            applyCashDiscount && cashDiscountEligibility?.discountDetails
              ? `Collect: ${formatCurrency(cashDiscountEligibility.discountDetails.paymentRequired)}`
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
            value={amountToPay}
            onChange={(e) => {
              setAmountToPay(e.target.value);
              // Reset discount confirmation when amount changes
              setApplyCashDiscount(false);
            }}
            error={!!state.errors?.amount}
            required
            className={`font-mono text-base ${applyCashDiscount ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
          />
        </FormField>

        <FormField label="Payment method" required error={state.errors?.paymentMethod}>
          <select
            id="paymentMethod"
            name="paymentMethod"
            className="form-control"
            required
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="gcash">GCash</option>
            <option value="other">Other</option>
          </select>
        </FormField>
      </div>

      {paymentMethod === "cash" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Amount tendered"
              required
              error={state.errors?.amountTendered}
              hint={
                applyCashDiscount && cashDiscountEligibility?.discountDetails
                  ? `Cash received · at least ${formatCurrency(cashDiscountEligibility.discountDetails.paymentRequired)}`
                  : "Cash received · must be at least the amount to pay"
              }
            >
              <Input
                type="number"
                id="amountTendered"
                name="amountTendered"
                step="0.01"
                min="0"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                error={!!state.errors?.amountTendered}
                className="font-mono text-base"
                autoComplete="off"
              />
            </FormField>
            <div className="rounded-lg border border-border bg-muted px-4 py-3">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Change
              </span>
              <span className="mt-2 block font-mono text-lg font-semibold text-foreground">
                {payNum > 0 && tenderNum >= payNum ? (
                  <CurrencyDisplay amount={change} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      <FormField
        label="Reference no."
        required={paymentMethod === "gcash" || paymentMethod === "bank_transfer"}
        error={state.errors?.referenceNumber}
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
          error={!!state.errors?.referenceNumber}
          className="font-mono text-sm"
        />
      </FormField>

      <FormField label="Remarks">
        <Input type="text" id="remarks" name="remarks" placeholder="Optional" />
      </FormField>

      <FormActions
        submitLabel={pending ? "Posting…" : "Post payment & print OR"}
        cancelLabel="Cancel"
        onCancel={onCancel}
        loading={pending}
        // !hydrated: block pre-hydration submits (full-page POST fallback) on
        // this financial form — see useHydrated (audit finding F6).
        // Allow posting when manual entry is enabled (doesn't need active booklets).
        submitDisabled={(!isManualEntry && activeBooklets.length === 0) || !hydrated}
      />
    </form>
  );
}
