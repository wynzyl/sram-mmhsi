"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { postPaymentAction } from "../payments.actions";
import type { PaymentFormState } from "../payments.schema";
import type { CashDiscountEligibility, AppliedCashDiscountDetails } from "../payments.queries";
import { NumericKeypad } from "./NumericKeypad";
import { CashDiscountPreviewCard } from "./CashDiscountPreviewCard";
import { AppliedCashDiscountCard } from "./AppliedCashDiscountCard";
import {
  PaymentSuccessOverlay,
  PaymentProcessingHeader,
  AssessmentSummaryCard,
  LastPaymentCard,
  ChangeDisplayCard,
} from "./cashier";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/FormField";
import { formatStoredOrNumber } from "@/lib/utils/or-number";
import { formatCurrency, roundToTwoDecimals } from "@/lib/utils/currency";
import { generateUuid } from "@/lib/utils/uuid";
import { Copy, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type PaymentMethod = "cash" | "check" | "bank_transfer" | "gcash" | "other";
type PaymentMethodCategory = "CASH" | "CHECK" | "ONLINE";

type ActiveBooklet = {
  id: string;
  series: string;
  prefix: string;
  nextNumber: number;
  endNumber: number;
};

export type CashierPaymentProcessingViewProps = {
  assessmentId: string;
  studentId: string;
  studentName: string;
  referenceNumber: string;
  gradeLevel: string;
  schoolYear: string;
  totals: {
    totalAssessed: number;
    totalPaid: number;
    balance: number;
  };
  lastPayment:
    | {
        amount: number;
        paymentMethod: string;
        paymentDateLabel: string;
        orNumber: string | null;
      }
    | null;
  activeBooklets: ActiveBooklet[];
  defaultBookletId?: string | null;
  manualSuggestions?: {
    lastManualPaymentDate: string | null;
    suggestedOrNumbers: { bookletId: string; series: string; nextOr: string }[];
  } | null;
  /** Details of cash discount already applied via approval workflow */
  appliedCashDiscountDetails?: AppliedCashDiscountDetails | null;
};

export function CashierPaymentProcessingView({
  assessmentId,
  studentId,
  studentName,
  referenceNumber,
  gradeLevel,
  schoolYear,
  totals,
  lastPayment,
  activeBooklets,
  defaultBookletId,
  manualSuggestions,
  appliedCashDiscountDetails,
}: CashierPaymentProcessingViewProps) {
  const router = useRouter();
  const hydrated = useHydrated();

  // Form state
  const initialState: PaymentFormState = {};
  const [state, action, pending] = useActionState(postPaymentAction, initialState);

  // Payment form state
  const [paymentMethodCategory, setPaymentMethodCategory] = useState<PaymentMethodCategory>("CASH");
  const [onlineMethod, setOnlineMethod] = useState<"bank_transfer" | "gcash" | "other">("gcash");
  const [amountToPay, setAmountToPay] = useState(String(totals.balance));
  const [amountTendered, setAmountTendered] = useState("");
  const [copied, setCopied] = useState(false);

  // Default booklet selection
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

  // Idempotency key for retried submissions
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdempotencyKey(generateUuid());
  }, []);

  // Prefetch and success handling
  useEffect(() => {
    router.prefetch("/staff/payments");
  }, [router]);

  useEffect(() => {
    if (state.success) {
      const t = window.setTimeout(() => router.push("/staff/payments"), 1600);
      return () => window.clearTimeout(t);
    }
  }, [state.success, router]);

  // Derived values
  const paymentMethod: PaymentMethod = paymentMethodCategory === "CASH"
    ? "cash"
    : paymentMethodCategory === "CHECK"
      ? "check"
      : onlineMethod;

  const payNum = Number.parseFloat(amountToPay) || 0;
  const tenderNum = Number.parseFloat(amountTendered) || 0;
  const change = paymentMethod === "cash" && tenderNum >= payNum && payNum > 0
    ? roundToTwoDecimals(tenderNum - payNum)
    : 0;

  const isReadyToPost = paymentMethod === "cash"
    ? tenderNum >= payNum && payNum > 0
    : payNum > 0;

  // Numpad handlers
  const handleDigit = useCallback((digit: string) => {
    setAmountTendered(prev => {
      if (digit === ".") {
        if (prev.includes(".")) return prev;
        return prev === "" ? "0." : prev + ".";
      }
      const parts = prev.split(".");
      if (parts[1]?.length >= 2) return prev;
      return prev + digit;
    });
  }, []);

  const handleClear = useCallback(() => {
    setAmountTendered("");
  }, []);

  const handleBackspace = useCallback(() => {
    setAmountTendered(prev => prev.slice(0, -1));
  }, []);

  // Copy amount to clipboard
  const handleCopyAmount = async () => {
    await navigator.clipboard.writeText(String(totals.balance));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format number with commas for display
  const formatWithCommas = (value: string): string => {
    if (!value) return "";
    const parts = value.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
  };

  // Strip commas and non-numeric chars for storage
  const stripFormatting = (value: string): string => {
    return value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  };

  // Manual entry toggle handler
  const handleManualEntryToggle = (checked: boolean) => {
    setIsManualEntry(checked);
    if (checked && manualSuggestions) {
      if (manualSuggestions.lastManualPaymentDate && !manualPaymentDate) {
        setManualPaymentDate(manualSuggestions.lastManualPaymentDate);
      }
      if (manualSuggestions.suggestedOrNumbers[0] && !manualOrNumber) {
        setManualOrNumber(manualSuggestions.suggestedOrNumbers[0].nextOr);
      }
    }
  };

  // Check cash discount eligibility
  // Skip if discount is already applied via approval workflow
  const hasAppliedCashDiscount = appliedCashDiscountDetails?.hasAppliedCashDiscount ?? false;

  const checkCashDiscountEligibility = useCallback(async () => {
    // Skip if discount was already applied via approval workflow
    if (hasAppliedCashDiscount) return;
    if (applyCashDiscount) return;

    const payNum = parseFloat(amountToPay);
    const EPSILON = 0.01;

    if (isNaN(payNum) || payNum < totals.balance - EPSILON) {
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
  }, [amountToPay, totals.balance, assessmentId, applyCashDiscount, hasAppliedCashDiscount]);

  // Debounced eligibility check
  useEffect(() => {
    // Skip if discount was already applied
    if (hasAppliedCashDiscount) return;

    const timer = setTimeout(() => {
      checkCashDiscountEligibility();
    }, 300);
    return () => clearTimeout(timer);
  }, [checkCashDiscountEligibility, hasAppliedCashDiscount]);

  // Success state
  if (state.success) {
    return (
      <PaymentSuccessOverlay
        message={state.message}
        onClose={() => router.push("/staff/payments")}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/35 p-2 sm:items-center sm:p-3 md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-payment-modal-title"
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg max-h-[100dvh] sm:max-h-[calc(100dvh-1.5rem)] md:max-h-[calc(100dvh-2rem)]"
      >
        <PaymentProcessingHeader
          referenceNumber={referenceNumber}
          studentName={studentName}
          gradeLevel={gradeLevel}
          schoolYear={schoolYear}
          onBack={() => router.push("/staff/payments")}
        />

        <form action={action} className="flex-1 overflow-y-auto">
          <div className="px-3 py-3 md:px-4 md:py-4">
            {/* Error messages */}
            {state.errors?._form && (
              <div
                className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {state.errors._form.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
            {state.message && !state.success && (
              <div
                className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {state.message}
              </div>
            )}

            {/* Hidden fields */}
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <input type="hidden" name="isManualEntry" value={String(isManualEntry)} />
            {/* Don't apply cash discount at payment time if already applied via approval workflow */}
            <input type="hidden" name="applyCashDiscount" value={String(applyCashDiscount && !hasAppliedCashDiscount)} />
            <input type="hidden" name="paymentMethod" value={paymentMethod} />
            <input type="hidden" name="amount" value={amountToPay} />
            {paymentMethod === "cash" && (
              <input type="hidden" name="amountTendered" value={amountTendered} />
            )}

            {/* Already Applied Cash Discount (read-only info card) */}
            {hasAppliedCashDiscount && appliedCashDiscountDetails?.discountDetails && (
              <div className="mb-4">
                <AppliedCashDiscountCard details={appliedCashDiscountDetails.discountDetails} />
              </div>
            )}

            {/* Cash Discount Eligibility Preview (only show if not already applied) */}
            {!hasAppliedCashDiscount && cashDiscountLoading && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Checking discount eligibility...</span>
              </div>
            )}

            {!hasAppliedCashDiscount && !cashDiscountLoading && cashDiscountEligibility?.eligible && cashDiscountEligibility.discountDetails && (
              <div className="mb-4">
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
                    if (cashDiscountEligibility?.discountDetails) {
                      setAmountToPay(String(cashDiscountEligibility.discountDetails.paymentRequired));
                    }
                  }}
                  onDecline={() => {
                    setApplyCashDiscount(false);
                    setAmountToPay(String(totals.balance));
                  }}
                  cascadePreview={cashDiscountEligibility.discountDetails.cascadePreview}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12">
              {/* Left Column */}
              <div className="space-y-3 md:space-y-4 lg:col-span-8">
                {/* Top Row: Two side-by-side cards */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  {/* Payment Info Card */}
                  <Card>
                    <CardContent className="space-y-4 p-4">
                      {/* Amount Due */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Amount due</span>
                          <button
                            type="button"
                            onClick={handleCopyAmount}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy amount"
                          >
                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="font-display text-2xl font-black text-primary">
                          <CurrencyDisplay amount={totals.balance} />
                        </p>
                      </div>

                      {/* Manual Entry Toggle */}
                      <div className="flex-row-2">
                        <input
                          type="checkbox"
                          id="isManualEntryToggle"
                          checked={isManualEntry}
                          onChange={(e) => handleManualEntryToggle(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="isManualEntryToggle" className="text-sm">
                          Manual entry
                        </label>
                      </div>

                      {/* Manual Entry Fields */}
                      {isManualEntry && (
                        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            Offline Payment
                          </p>
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
                              className="h-9"
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
                              className="h-9 font-mono"
                            />
                          </FormField>
                        </div>
                      )}

                      {/* OR Booklet - only show when NOT manual entry */}
                      {!isManualEntry && (
                        <div>
                          <label htmlFor="bookletId" className="mb-1.5 block text-sm font-medium">
                            OR booklet <span className="text-destructive">*</span>
                          </label>
                          {activeBooklets.length === 0 ? (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              No active receipt booklets. Ask Finance to activate a booklet.
                            </div>
                          ) : (
                            <select
                              id="bookletId"
                              name="bookletId"
                              className="form-control h-9 w-full"
                              required
                              disabled={activeBooklets.length === 0}
                              value={selectedBookletId}
                              onChange={(e) => setSelectedBookletId(e.target.value)}
                            >
                              {activeBooklets.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.series} — Next: {formatStoredOrNumber(b.prefix, b.nextNumber)}
                                </option>
                              ))}
                            </select>
                          )}
                          {state.errors?.bookletId && (
                            <p className="mt-1 text-sm text-destructive">{state.errors.bookletId[0]}</p>
                          )}
                        </div>
                      )}

                      {/* Payment Method Toggle */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">
                          Payment method <span className="text-destructive">*</span>
                        </label>
                        <div className="flex rounded-lg border border-border p-1">
                          {(["CASH", "CHECK", "ONLINE"] as const).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setPaymentMethodCategory(cat)}
                              className={cn(
                                "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                                paymentMethodCategory === cat
                                  ? "bg-foreground text-background"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                        {state.errors?.paymentMethod && (
                          <p className="mt-1 text-sm text-destructive">{state.errors.paymentMethod[0]}</p>
                        )}
                      </div>

                      {/* Online sub-select */}
                      {paymentMethodCategory === "ONLINE" && (
                        <div>
                          <label htmlFor="onlineMethod" className="mb-1.5 block text-sm font-medium">
                            Online method
                          </label>
                          <select
                            id="onlineMethod"
                            className="form-control h-9 w-full"
                            value={onlineMethod}
                            onChange={(e) => setOnlineMethod(e.target.value as typeof onlineMethod)}
                          >
                            <option value="gcash">GCash</option>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Amount Entry Card */}
                  <Card>
                    <CardContent className="p-4">
                      {/* Amount to Pay */}
                      <div className="mb-3">
                        <label
                          htmlFor="amountToPayInput"
                          className="mb-1.5 block text-sm font-medium"
                        >
                          Amount to pay {applyCashDiscount && "(after discount)"} <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-600">
                            ₱
                          </span>
                          <Input
                            id="amountToPayInput"
                            type="text"
                            inputMode="decimal"
                            value={formatWithCommas(amountToPay)}
                            onChange={(e) => setAmountToPay(stripFormatting(e.target.value))}
                            className="h-14 pl-10 font-mono text-3xl font-black text-emerald-600"
                            placeholder="0.00"
                            autoComplete="off"
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Maximum {formatCurrency(totals.balance)}
                        </p>
                        {state.errors?.amount && (
                          <p className="mt-1 text-sm text-destructive">{state.errors.amount[0]}</p>
                        )}
                      </div>

                      {/* Amount Tendered - only for cash */}
                      {paymentMethod === "cash" && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <label
                            htmlFor="amountTenderedInput"
                            className="mb-1.5 block text-sm font-medium"
                          >
                            Amount tendered <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-600">
                              ₱
                            </span>
                            <Input
                              id="amountTenderedInput"
                              type="text"
                              inputMode="decimal"
                              value={formatWithCommas(amountTendered)}
                              onChange={(e) => setAmountTendered(stripFormatting(e.target.value))}
                              className="h-14 pl-10 font-mono text-3xl font-black text-emerald-600"
                              placeholder="0.00"
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Cash received — must be at least the amount to pay
                          </p>
                          {state.errors?.amountTendered && (
                            <p className="mt-1 text-sm text-destructive">{state.errors.amountTendered[0]}</p>
                          )}

                          {/* Numeric Keypad */}
                          <div className="mt-3">
                            <NumericKeypad
                              onDigit={handleDigit}
                              onClear={handleClear}
                              onBackspace={handleBackspace}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Bottom Row: Reference and Remarks */}
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        label="Reference no."
                        required={paymentMethod === "gcash" || paymentMethod === "bank_transfer"}
                        error={state.errors?.referenceNumber}
                        hint={
                          paymentMethod === "gcash" || paymentMethod === "bank_transfer"
                            ? "Required for GCash / bank transfer"
                            : "Check no., ref no., etc."
                        }
                      >
                        <Input
                          type="text"
                          id="referenceNumber"
                          name="referenceNumber"
                          placeholder={
                            paymentMethod === "gcash" || paymentMethod === "bank_transfer"
                              ? "Transaction reference"
                              : "Optional"
                          }
                          required={paymentMethod === "gcash" || paymentMethod === "bank_transfer"}
                          className="h-9 font-mono text-sm"
                        />
                      </FormField>
                      <FormField label="Remarks">
                        <Input
                          type="text"
                          id="remarks"
                          name="remarks"
                          placeholder="Optional notes"
                          className="h-9"
                        />
                      </FormField>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-3 md:space-y-4 lg:col-span-4">
                <AssessmentSummaryCard
                  totalAssessed={totals.totalAssessed}
                  totalPaid={totals.totalPaid}
                  balance={totals.balance}
                />

                <LastPaymentCard lastPayment={lastPayment} />

                <ChangeDisplayCard change={change} isReadyToPost={isReadyToPost} />

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={
                      pending ||
                      (!isManualEntry && activeBooklets.length === 0) ||
                      !hydrated ||
                      !isReadyToPost
                    }
                  >
                    {pending ? "Posting…" : "Post Payment & Print OR"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => router.push("/staff/payments")}
                  >
                    Cancel Transaction
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
