"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@/hooks/useHydrated";
import { queryKeys } from "@/lib/query/keys";
import {
  usePaymentForm,
  type ActiveBooklet,
  type ManualSuggestions,
} from "../hooks";
import type { AppliedCashDiscountDetails, CascadeFixNeeded } from "../payments.queries";
import { NumericKeypad } from "./NumericKeypad";
import { CashDiscountPreviewCard } from "./CashDiscountPreviewCard";
import { AppliedCashDiscountCard } from "./AppliedCashDiscountCard";
import { CascadeFixCard } from "./CascadeFixCard";
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
import { formatCurrency } from "@/lib/utils/currency";
import { Copy, Check, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

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
  lastPayment: {
    amount: number;
    paymentMethod: string;
    paymentDateLabel: string;
    orNumber: string | null;
  } | null;
  activeBooklets: ActiveBooklet[];
  defaultBookletId?: string | null;
  manualSuggestions?: ManualSuggestions | null;
  /** Details of cash discount already applied via approval workflow */
  appliedCashDiscountDetails?: AppliedCashDiscountDetails | null;
  /** Data for cascade fix if discounts were applied out-of-order */
  cascadeFixData?: CascadeFixNeeded | null;
};

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

/**
 * Full-screen cashier payment processing view.
 *
 * Uses the shared usePaymentForm hook for state management and
 * cash discount eligibility checking.
 */
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
  cascadeFixData,
}: CashierPaymentProcessingViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const [copied, setCopied] = useState(false);
  const [amountToPayFocused, setAmountToPayFocused] = useState(false);
  const [amountTenderedFocused, setAmountTenderedFocused] = useState(false);

  // ─────────────────────────────────────────────────────────────────
  // Memoized Derived Values
  // ─────────────────────────────────────────────────────────────────

  // Check if cash discount was already applied via approval workflow
  const { hasAppliedCashDiscount, isDiscountExpired } = useMemo(
    () => ({
      hasAppliedCashDiscount:
        appliedCashDiscountDetails?.hasAppliedCashDiscount ?? false,
      isDiscountExpired:
        appliedCashDiscountDetails?.discountDetails?.isExpired ?? false,
    }),
    [appliedCashDiscountDetails]
  );

  // Use shared payment form hook
  const form = usePaymentForm({
    assessmentId,
    balance: totals.balance,
    activeBooklets,
    defaultBookletId,
    manualSuggestions,
    hasAppliedCashDiscount,
    onSuccess: () => {
      // Invalidate TanStack Query caches for instant refresh on queue page
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.queue() });
      queryClient.invalidateQueries({ queryKey: queryKeys.booklets.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      router.push("/staff/payments");
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // Memoized Handlers
  // ─────────────────────────────────────────────────────────────────

  // Copy amount to clipboard
  const handleCopyAmount = useCallback(async () => {
    await navigator.clipboard.writeText(String(totals.balance));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [totals.balance]);

  // Format number with commas for display and limit to 2 decimal places
  const formatWithCommas = useCallback((value: string): string => {
    if (!value) return "";
    // Parse and round to 2 decimal places first
    const num = parseFloat(value);
    if (isNaN(num)) return "";
    const rounded = (Math.round(num * 100) / 100).toFixed(2);
    const parts = rounded.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${intPart}.${parts[1]}`;
  }, []);

  // Success state
  if (form.state.success) {
    return (
      <PaymentSuccessOverlay
        message={form.state.message}
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

        <form action={form.action} className="flex-1 overflow-y-auto">
          <div className="px-3 py-3 md:px-4 md:py-4">
            {/* Error messages */}
            {form.state.errors?._form && (
              <div
                className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {form.state.errors._form.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
            {form.state.message && !form.state.success && (
              <div
                className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {form.state.message}
              </div>
            )}

            {/* Hidden fields */}
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="idempotencyKey" value={form.idempotencyKey} />
            <input
              type="hidden"
              name="isManualEntry"
              value={String(form.isManualEntry)}
            />
            {/* Don't apply cash discount at payment time if already applied via approval workflow */}
            <input
              type="hidden"
              name="applyCashDiscount"
              value={String(form.applyCashDiscount && !hasAppliedCashDiscount)}
            />
            <input type="hidden" name="paymentMethod" value={form.paymentMethod} />
            <input type="hidden" name="amount" value={form.amountToPay} />
            {form.paymentMethod === "cash" && (
              <input type="hidden" name="amountTendered" value={form.amountTendered} />
            )}

            {/* Already Applied Cash Discount (read-only info card) */}
            {hasAppliedCashDiscount && appliedCashDiscountDetails?.discountDetails && (
              <div className="mb-4">
                <AppliedCashDiscountCard
                  details={appliedCashDiscountDetails.discountDetails}
                  assessmentId={assessmentId}
                />
              </div>
            )}

            {/* Cascade Fix Required (discounts applied out-of-order) */}
            {cascadeFixData?.needsFix && (
              <div className="mb-4">
                <CascadeFixCard assessmentId={assessmentId} fixData={cascadeFixData} />
              </div>
            )}

            {/* Cash Discount Eligibility Preview (only show if not already applied) */}
            {!hasAppliedCashDiscount && form.cashDiscountLoading && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Checking discount eligibility...
                </span>
              </div>
            )}

            {!hasAppliedCashDiscount &&
              !form.cashDiscountLoading &&
              !form.discountDeclined &&
              form.cashDiscountEligibility?.eligible &&
              form.cashDiscountEligibility.discountDetails && (
                <div className="mb-4">
                  <CashDiscountPreviewCard
                    baseAmount={form.cashDiscountEligibility.discountDetails.baseAmount}
                    discountValue={
                      form.cashDiscountEligibility.discountDetails.discountValue
                    }
                    calculationType={
                      form.cashDiscountEligibility.discountDetails.calculationType
                    }
                    baseType={form.cashDiscountEligibility.discountDetails.baseType}
                    cashDiscountAmount={
                      form.cashDiscountEligibility.discountDetails.cashDiscountAmount
                    }
                    currentBalance={
                      form.cashDiscountEligibility.discountDetails.currentBalance
                    }
                    newBalance={form.cashDiscountEligibility.discountDetails.newBalance}
                    paymentRequired={
                      form.cashDiscountEligibility.discountDetails.paymentRequired
                    }
                    cutoffDate={form.cashDiscountEligibility.discountDetails.cutoffDate}
                    isConfirmed={form.applyCashDiscount}
                    onConfirm={form.handleConfirmCashDiscount}
                    onDecline={form.handleDeclineCashDiscount}
                    cascadePreview={
                      form.cashDiscountEligibility.discountDetails.cascadePreview
                    }
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
                          <span className="text-sm font-medium text-muted-foreground">
                            Amount due
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyAmount}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy amount"
                          >
                            {copied ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
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
                          checked={form.isManualEntry}
                          onChange={(e) =>
                            form.handleManualEntryToggle(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="isManualEntryToggle" className="text-sm">
                          Manual entry
                        </label>
                      </div>

                      {/* Manual Entry Fields */}
                      {form.isManualEntry && (
                        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            Offline Payment
                          </p>
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
                              onChange={(e) =>
                                form.setManualPaymentDate(e.target.value)
                              }
                              max={new Date().toISOString().split("T")[0]}
                              required={form.isManualEntry}
                              className="h-9"
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
                              onChange={(e) =>
                                form.setManualOrNumber(e.target.value.toUpperCase())
                              }
                              placeholder="AK 00050"
                              required={form.isManualEntry}
                              className="h-9 font-mono"
                            />
                          </FormField>
                        </div>
                      )}

                      {/* OR Booklet - only show when NOT manual entry */}
                      {!form.isManualEntry && (
                        <div>
                          <label
                            htmlFor="bookletId"
                            className="mb-1.5 block text-sm font-medium"
                          >
                            OR booklet <span className="text-destructive">*</span>
                          </label>
                          {activeBooklets.length === 0 ? (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              No active receipt booklets. Ask Finance to activate a
                              booklet.
                            </div>
                          ) : (
                            <select
                              id="bookletId"
                              name="bookletId"
                              className="form-control h-9 w-full"
                              required
                              disabled={activeBooklets.length === 0}
                              value={form.selectedBookletId}
                              onChange={(e) =>
                                form.setSelectedBookletId(e.target.value)
                              }
                            >
                              {activeBooklets.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.series} — Next:{" "}
                                  {formatStoredOrNumber(b.prefix, b.nextNumber)}
                                </option>
                              ))}
                            </select>
                          )}
                          {form.state.errors?.bookletId && (
                            <p className="mt-1 text-sm text-destructive">
                              {form.state.errors.bookletId[0]}
                            </p>
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
                              onClick={() => form.setPaymentMethodCategory(cat)}
                              className={cn(
                                "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                                form.paymentMethodCategory === cat
                                  ? "bg-foreground text-background"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                        {form.state.errors?.paymentMethod && (
                          <p className="mt-1 text-sm text-destructive">
                            {form.state.errors.paymentMethod[0]}
                          </p>
                        )}
                      </div>

                      {/* Online sub-select */}
                      {form.paymentMethodCategory === "ONLINE" && (
                        <div>
                          <label
                            htmlFor="onlineMethod"
                            className="mb-1.5 block text-sm font-medium"
                          >
                            Online method
                          </label>
                          <select
                            id="onlineMethod"
                            className="form-control h-9 w-full"
                            value={form.onlineMethod}
                            onChange={(e) =>
                              form.setOnlineMethod(
                                e.target.value as typeof form.onlineMethod
                              )
                            }
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
                          className="mb-1.5 flex items-center gap-2 text-sm font-medium"
                        >
                          <span>
                            Amount to pay{" "}
                            {(form.applyCashDiscount || hasAppliedCashDiscount) &&
                              "(full payment required)"}
                            <span className="text-destructive"> *</span>
                          </span>
                          {(form.applyCashDiscount || hasAppliedCashDiscount) && (
                            <Lock className="h-4 w-4 text-amber-600" />
                          )}
                        </label>
                        <div className="relative">
                          <span
                            className={cn(
                              "absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-black",
                              form.applyCashDiscount || hasAppliedCashDiscount
                                ? "text-amber-600"
                                : "text-emerald-600"
                            )}
                          >
                            ₱
                          </span>
                          <Input
                            id="amountToPayInput"
                            type="text"
                            inputMode="decimal"
                            value={
                              amountToPayFocused
                                ? form.amountToPay
                                : formatWithCommas(form.amountToPay)
                            }
                            onChange={(e) => {
                              form.setAmountToPay(
                                e.target.value.replace(/[^0-9.]/g, "")
                              );
                              // Reset discount states when amount changes
                              form.setApplyCashDiscount(false);
                              form.setDiscountDeclined(false);
                            }}
                            onFocus={() => setAmountToPayFocused(true)}
                            onBlur={() => setAmountToPayFocused(false)}
                            className={cn(
                              "h-14 pl-10 font-mono text-3xl font-black",
                              form.applyCashDiscount || hasAppliedCashDiscount
                                ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30 cursor-not-allowed"
                                : "text-emerald-600"
                            )}
                            placeholder="0.00"
                            autoComplete="off"
                            disabled={form.applyCashDiscount || hasAppliedCashDiscount}
                            readOnly={form.applyCashDiscount || hasAppliedCashDiscount}
                          />
                        </div>
                        {form.applyCashDiscount || hasAppliedCashDiscount ? (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            Full payment is required to receive the cash discount.
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Maximum {formatCurrency(totals.balance)}
                          </p>
                        )}
                        {form.state.errors?.amount && (
                          <p className="mt-1 text-sm text-destructive">
                            {form.state.errors.amount[0]}
                          </p>
                        )}
                      </div>

                      {/* Amount Tendered - only for cash */}
                      {form.paymentMethod === "cash" && (
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
                              value={
                                amountTenderedFocused
                                  ? form.amountTendered
                                  : formatWithCommas(form.amountTendered)
                              }
                              onChange={(e) =>
                                form.setAmountTendered(
                                  e.target.value.replace(/[^0-9.]/g, "")
                                )
                              }
                              onFocus={() => setAmountTenderedFocused(true)}
                              onBlur={() => setAmountTenderedFocused(false)}
                              className="h-14 pl-10 font-mono text-3xl font-black text-emerald-600"
                              placeholder="0.00"
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Cash received — must be at least the amount to pay
                          </p>
                          {form.state.errors?.amountTendered && (
                            <p className="mt-1 text-sm text-destructive">
                              {form.state.errors.amountTendered[0]}
                            </p>
                          )}

                          {/* Numeric Keypad */}
                          <div className="mt-3">
                            <NumericKeypad
                              onDigit={form.handleDigit}
                              onClear={form.handleClear}
                              onBackspace={form.handleBackspace}
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
                        required={
                          form.paymentMethod === "gcash" ||
                          form.paymentMethod === "bank_transfer"
                        }
                        error={form.state.errors?.referenceNumber}
                        hint={
                          form.paymentMethod === "gcash" ||
                          form.paymentMethod === "bank_transfer"
                            ? "Required for GCash / bank transfer"
                            : "Check no., ref no., etc."
                        }
                      >
                        <Input
                          type="text"
                          id="referenceNumber"
                          name="referenceNumber"
                          placeholder={
                            form.paymentMethod === "gcash" ||
                            form.paymentMethod === "bank_transfer"
                              ? "Transaction reference"
                              : "Optional"
                          }
                          required={
                            form.paymentMethod === "gcash" ||
                            form.paymentMethod === "bank_transfer"
                          }
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

                <ChangeDisplayCard
                  change={form.change}
                  isReadyToPost={form.isReadyToPost}
                />

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={
                      form.pending ||
                      (!form.isManualEntry && activeBooklets.length === 0) ||
                      !hydrated ||
                      !form.isReadyToPost ||
                      isDiscountExpired
                    }
                  >
                    {form.pending
                      ? "Posting…"
                      : isDiscountExpired
                        ? "Discount Expired — Reversal Required"
                        : "Post Payment & Print OR"}
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
