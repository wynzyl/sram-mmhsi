"use client";

import { useActionState, useEffect, useState, useCallback, useMemo } from "react";
import { postPaymentAction } from "../payments.actions";
import type { PaymentFormState } from "../payments.schema";
import type { CashDiscountEligibility } from "../payments.queries";
import { generateUuid } from "@/lib/utils/uuid";
import { roundToTwoDecimals, formatDecimal } from "@/lib/utils/currency";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "check" | "bank_transfer" | "gcash" | "other";
export type PaymentMethodCategory = "CASH" | "CHECK" | "ONLINE";

export interface ActiveBooklet {
  id: string;
  series: string;
  prefix: string;
  nextNumber: number;
  endNumber: number;
}

export interface ManualSuggestions {
  lastManualPaymentDate: string | null;
  suggestedOrNumbers: { bookletId: string; series: string; nextOr: string }[];
}

export interface UsePaymentFormOptions {
  assessmentId: string;
  balance: number;
  activeBooklets: ActiveBooklet[];
  defaultBookletId?: string | null;
  manualSuggestions?: ManualSuggestions | null;
  /** Skip eligibility check if cash discount already applied via approval workflow */
  hasAppliedCashDiscount?: boolean;
  /** Callback after successful payment post */
  onSuccess?: () => void;
}

export interface UsePaymentFormReturn {
  // Action state
  state: PaymentFormState;
  action: (payload: FormData) => void;
  pending: boolean;

  // Payment method
  paymentMethodCategory: PaymentMethodCategory;
  setPaymentMethodCategory: (category: PaymentMethodCategory) => void;
  onlineMethod: "bank_transfer" | "gcash" | "other";
  setOnlineMethod: (method: "bank_transfer" | "gcash" | "other") => void;
  /** Derived payment method from category + online method */
  paymentMethod: PaymentMethod;

  // Amount state
  amountToPay: string;
  setAmountToPay: (amount: string) => void;
  amountTendered: string;
  setAmountTendered: (amount: string) => void;

  // Booklet selection
  selectedBookletId: string;
  setSelectedBookletId: (id: string) => void;

  // Manual entry
  isManualEntry: boolean;
  setIsManualEntry: (value: boolean) => void;
  manualPaymentDate: string;
  setManualPaymentDate: (date: string) => void;
  manualOrNumber: string;
  setManualOrNumber: (or: string) => void;
  handleManualEntryToggle: (checked: boolean) => void;

  // Cash discount
  cashDiscountEligibility: CashDiscountEligibility | null;
  cashDiscountLoading: boolean;
  applyCashDiscount: boolean;
  setApplyCashDiscount: (apply: boolean) => void;
  discountDeclined: boolean;
  setDiscountDeclined: (declined: boolean) => void;
  handleConfirmCashDiscount: () => void;
  handleDeclineCashDiscount: () => void;

  // Idempotency
  idempotencyKey: string;

  // Derived values (memoized)
  payNum: number;
  tenderNum: number;
  change: number;
  isReadyToPost: boolean;

  // Numpad handlers (for CashierPaymentProcessingView)
  handleDigit: (digit: string) => void;
  handleClear: () => void;
  handleBackspace: () => void;
}

// ─────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────

/**
 * Shared hook for payment form logic.
 *
 * Centralizes state management, cash discount eligibility checking,
 * and derived calculations used by both PostPaymentForm and
 * CashierPaymentProcessingView.
 *
 * PERFORMANCE: Memoizes derived values to prevent unnecessary re-renders.
 */
export function usePaymentForm({
  assessmentId,
  balance,
  activeBooklets,
  defaultBookletId,
  manualSuggestions,
  hasAppliedCashDiscount = false,
  onSuccess,
}: UsePaymentFormOptions): UsePaymentFormReturn {
  // ─────────────────────────────────────────────────────────────────
  // Action State
  // ─────────────────────────────────────────────────────────────────
  const initialState: PaymentFormState = {};
  const [state, action, pending] = useActionState(postPaymentAction, initialState);

  // ─────────────────────────────────────────────────────────────────
  // Payment Method State
  // ─────────────────────────────────────────────────────────────────
  const [paymentMethodCategory, setPaymentMethodCategory] =
    useState<PaymentMethodCategory>("CASH");
  const [onlineMethod, setOnlineMethod] =
    useState<"bank_transfer" | "gcash" | "other">("gcash");

  // ─────────────────────────────────────────────────────────────────
  // Amount State
  // ─────────────────────────────────────────────────────────────────
  const [amountToPay, setAmountToPay] = useState(formatDecimal(balance));
  const [amountTendered, setAmountTendered] = useState("");

  // ─────────────────────────────────────────────────────────────────
  // Booklet Selection
  // ─────────────────────────────────────────────────────────────────
  const [selectedBookletId, setSelectedBookletId] = useState<string>(() => {
    if (defaultBookletId && activeBooklets.some((b) => b.id === defaultBookletId)) {
      return defaultBookletId;
    }
    return activeBooklets[0]?.id ?? "";
  });

  // ─────────────────────────────────────────────────────────────────
  // Manual Entry State
  // ─────────────────────────────────────────────────────────────────
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualPaymentDate, setManualPaymentDate] = useState("");
  const [manualOrNumber, setManualOrNumber] = useState("");

  const handleManualEntryToggle = useCallback(
    (checked: boolean) => {
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
    },
    [manualSuggestions, manualPaymentDate, manualOrNumber]
  );

  // ─────────────────────────────────────────────────────────────────
  // Cash Discount State
  // ─────────────────────────────────────────────────────────────────
  const [cashDiscountEligibility, setCashDiscountEligibility] =
    useState<CashDiscountEligibility | null>(null);
  const [cashDiscountLoading, setCashDiscountLoading] = useState(false);
  const [applyCashDiscount, setApplyCashDiscount] = useState(false);
  const [discountDeclined, setDiscountDeclined] = useState(false);

  // Check cash discount eligibility (debounced)
  const checkCashDiscountEligibility = useCallback(async () => {
    // Skip if discount was already applied via approval workflow
    if (hasAppliedCashDiscount) return;
    // Skip if discount is already confirmed
    if (applyCashDiscount) return;

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
  }, [amountToPay, balance, assessmentId, applyCashDiscount, hasAppliedCashDiscount]);

  // Debounced eligibility check on amount change
  useEffect(() => {
    if (hasAppliedCashDiscount) return;

    const timer = setTimeout(() => {
      checkCashDiscountEligibility();
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [checkCashDiscountEligibility, hasAppliedCashDiscount]);

  // Cash discount confirm/decline handlers
  const handleConfirmCashDiscount = useCallback(() => {
    setApplyCashDiscount(true);
    setDiscountDeclined(false);
    if (cashDiscountEligibility?.discountDetails) {
      setAmountToPay(formatDecimal(cashDiscountEligibility.discountDetails.paymentRequired));
    }
  }, [cashDiscountEligibility]);

  const handleDeclineCashDiscount = useCallback(() => {
    setApplyCashDiscount(false);
    setDiscountDeclined(true);
    setAmountToPay(formatDecimal(balance));
  }, [balance]);

  // Sync amountToPay with balance when cash discount is already applied
  // (e.g., after cascade recalculations update the balance)
  useEffect(() => {
    if (hasAppliedCashDiscount) {
      setAmountToPay(formatDecimal(balance));
    }
  }, [balance, hasAppliedCashDiscount]);

  // ─────────────────────────────────────────────────────────────────
  // Idempotency Key
  // ─────────────────────────────────────────────────────────────────
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => {
    // One-time client-only initialization: legitimate setState-in-effect —
    // the UUID must not be SSR-rendered or hydration would mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdempotencyKey(generateUuid());
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Success Handler
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.success && onSuccess) {
      const t = window.setTimeout(() => onSuccess(), 1600);
      return () => window.clearTimeout(t);
    }
  }, [state.success, onSuccess]);

  // ─────────────────────────────────────────────────────────────────
  // Derived Values (Memoized)
  // ─────────────────────────────────────────────────────────────────
  const paymentMethod: PaymentMethod = useMemo(() => {
    if (paymentMethodCategory === "CASH") return "cash";
    if (paymentMethodCategory === "CHECK") return "check";
    return onlineMethod;
  }, [paymentMethodCategory, onlineMethod]);

  const { payNum, tenderNum, change, isReadyToPost } = useMemo(() => {
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
    const isReadyToPost =
      paymentMethod === "cash" ? tenderNum >= payNum && payNum > 0 : payNum > 0;

    return { payNum, tenderNum, change, isReadyToPost };
  }, [
    amountToPay,
    amountTendered,
    applyCashDiscount,
    cashDiscountEligibility,
    paymentMethod,
  ]);

  // ─────────────────────────────────────────────────────────────────
  // Numpad Handlers (for CashierPaymentProcessingView)
  // ─────────────────────────────────────────────────────────────────
  const handleDigit = useCallback((digit: string) => {
    setAmountTendered((prev) => {
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
    setAmountTendered((prev) => prev.slice(0, -1));
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Return
  // ─────────────────────────────────────────────────────────────────
  return {
    // Action state
    state,
    action,
    pending,

    // Payment method
    paymentMethodCategory,
    setPaymentMethodCategory,
    onlineMethod,
    setOnlineMethod,
    paymentMethod,

    // Amount state
    amountToPay,
    setAmountToPay,
    amountTendered,
    setAmountTendered,

    // Booklet selection
    selectedBookletId,
    setSelectedBookletId,

    // Manual entry
    isManualEntry,
    setIsManualEntry,
    manualPaymentDate,
    setManualPaymentDate,
    manualOrNumber,
    setManualOrNumber,
    handleManualEntryToggle,

    // Cash discount
    cashDiscountEligibility,
    cashDiscountLoading,
    applyCashDiscount,
    setApplyCashDiscount,
    discountDeclined,
    setDiscountDeclined,
    handleConfirmCashDiscount,
    handleDeclineCashDiscount,

    // Idempotency
    idempotencyKey,

    // Derived values
    payNum,
    tenderNum,
    change,
    isReadyToPost,

    // Numpad handlers
    handleDigit,
    handleClear,
    handleBackspace,
  };
}
