/**
 * Payment feature type definitions
 *
 * Shared DTO types for payment-related queries and components.
 * These types are extracted from payments.queries.ts for better organization
 * and reusability across the codebase.
 */

// ─────────────────────────────────────────────────────────────────
// Cashier Queue Types
// ─────────────────────────────────────────────────────────────────

export type CashierQueueRow = {
  assessmentId: string;
  studentName: string;
  referenceNumber: string;
  gradeLevel: string;
  schoolYear: string;
  billingStatus: string;
  balance: number;
  totalPaid: number;
};

export type CashierStats = {
  totalCollectedToday: number;
  pendingPaymentsCount: number;
  studentsAssessed: number;
  totalCollectibles: number;
};

export type RecentCollection = {
  paymentId: string;
  orNumber: string | null;
  amount: number;
  paymentDate: Date;
  studentFirstName: string;
  studentLastName: string;
  assessmentId: string | null;
};

export type CashierQueueData = {
  queue: CashierQueueRow[];
  stats: CashierStats;
  recentCollections: RecentCollection[];
  queueTotalCount: number;
};

export type CashierQueueParams = {
  page?: number;
  pageSize?: number;
};

// ─────────────────────────────────────────────────────────────────
// Portal Payment Types
// ─────────────────────────────────────────────────────────────────

export type PortalPaymentRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentReference: string | null;
  orNumber: string | null;
  amount: number;
  paymentMethod: string;
  paymentDate: string; // ISO (serialized for client)
  status: string;
  paymentReference: string | null;
};

export type PortalPaymentsData = {
  rows: PortalPaymentRow[];
  showStudentColumn: boolean;
  hasLinkedStudents: boolean;
};

// ─────────────────────────────────────────────────────────────────
// Manual Entry Types
// ─────────────────────────────────────────────────────────────────

export type ManualEntrySuggestions = {
  lastManualPaymentDate: string | null;
  suggestedOrNumbers: { bookletId: string; series: string; nextOr: string }[];
};

// ─────────────────────────────────────────────────────────────────
// Cash Discount Eligibility Types
// ─────────────────────────────────────────────────────────────────

/** Cascade adjustment preview for a single discount */
export interface CascadeAdjustmentPreviewLine {
  /** Name of the discount being adjusted (e.g., "ESC Scholarship") */
  discountTypeName: string;
  /** Original discount amount before cascade */
  originalAmount: number;
  /** Recalculated discount amount after cascade */
  recalculatedAmount: number;
  /** The adjustment delta (original - recalculated), always positive */
  adjustmentAmount: number;
}

/** Cascade adjustment preview for UI display */
export interface CascadeAdjustmentPreview {
  /** Whether there are cascade adjustments to show */
  hasCascadeAdjustments: boolean;
  /** Individual adjustment lines for each affected discount */
  lines: CascadeAdjustmentPreviewLine[];
  /** Total cascade adjustment amount (reduces effective discount) */
  totalAdjustment: number;
  /** Human-readable explanation text */
  explanation: string;
}

export interface CashDiscountEligibility {
  eligible: boolean;
  reason?: string;
  discountDetails?: {
    discountTypeId: string;
    discountTypeName: string;
    calculationType: "fixed_amount" | "percentage";
    baseType: "tuition_only" | "full_assessment";
    discountValue: number;
    /** Tuition or full assessment total (base for percentage calculation) */
    baseAmount: number;
    /** Calculated discount amount (discountValue% of baseAmount or fixed) */
    cashDiscountAmount: number;
    /** Assessment balance before discount */
    currentBalance: number;
    /** New balance after discount is applied (includes cascade adjustments) */
    newBalance: number;
    /** Amount the cashier should collect (includes cascade adjustments) */
    paymentRequired: number;
    /** Cutoff date for the school year */
    cutoffDate: Date;
    /**
     * Cascade adjustment preview - shows how existing scholarships are
     * recalculated based on the discounted tuition amount.
     * Only present if there are tuition_only discounts to cascade.
     */
    cascadePreview?: CascadeAdjustmentPreview;
  };
}

// ─────────────────────────────────────────────────────────────────
// Applied Cash Discount Types (for display on payment page)
// ─────────────────────────────────────────────────────────────────

/** Cascade adjustment detail for an already-applied discount */
export interface AppliedCascadeAdjustment {
  /** Name of the discount that was adjusted (e.g., "ESC Scholarship") */
  discountTypeName: string;
  /** Original discount amount before cascade */
  originalAmount: number;
  /** The adjustment delta (original - recalculated), always positive */
  adjustmentAmount: number;
}

/** Related discount applied on the discounted tuition base (no adjustment needed) */
export interface RelatedTuitionDiscount {
  /** Name of the discount (e.g., "Sibling Discount") */
  discountTypeName: string;
  /** Base amount used (discounted tuition) */
  baseAmount: number;
  /** Discount amount applied */
  discountAmount: number;
}

/**
 * Details of a cash discount that has already been applied to an assessment.
 * Used to display read-only info on the payment page when discount was applied
 * via the approval workflow (not at payment time).
 */
export interface AppliedCashDiscountDetails {
  /** Whether a cash discount has been applied to this assessment */
  hasAppliedCashDiscount: boolean;
  /** Discount details (only present if hasAppliedCashDiscount is true) */
  discountDetails?: {
    /** The student discount record ID */
    studentDiscountId: string;
    /** Cash discount amount */
    discountAmount: number;
    /** When the discount was applied */
    appliedAt: Date;
    /** Name of the user who applied the discount */
    appliedByName: string;
    /** Cascade adjustments that were triggered (existing discounts recalculated) */
    cascadeAdjustments: AppliedCascadeAdjustment[];
    /** Total cascade adjustment amount */
    totalCascadeAdjustment: number;
    /** Related tuition discounts correctly applied on discounted base (no adjustment needed) */
    relatedDiscounts: RelatedTuitionDiscount[];
    /** Cutoff date for the cash discount (from school year) */
    cutoffDate: Date | null;
    /** Whether the discount has expired (past cutoff date, no payment made) */
    isExpired: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────
// Cascade Fix Types (for discounts applied out-of-order)
// ─────────────────────────────────────────────────────────────────

/** Individual cascade fix adjustment for a single discount */
export interface CascadeFixAdjustment {
  /** The student discount ID to be adjusted */
  studentDiscountId: string;
  /** Name of the discount being adjusted (e.g., "Sibling Discount") */
  discountTypeName: string;
  /** Original base amount (before cash discount was applied) */
  originalBase: number;
  /** Correct base amount (after cash discount) */
  correctBase: number;
  /** Original discount amount (calculated on wrong base) */
  originalAmount: number;
  /** Correct discount amount (recalculated on correct base) */
  correctAmount: number;
  /** The adjustment needed (originalAmount - correctAmount) */
  adjustmentNeeded: number;
  /** The assessment item created for this discount */
  assessmentItemId: string | null;
}

/**
 * Result of checking if cascade fix is needed.
 * Returned when cash discount was applied first, but sibling/scholarship discounts
 * were applied later using the original (non-discounted) tuition base.
 */
export interface CascadeFixNeeded {
  /** Always true when returned (null is returned if no fix needed) */
  needsFix: true;
  /** ID of the cash discount that should have triggered cascade */
  cashDiscountId: string;
  /** Amount of the cash discount */
  cashDiscountAmount: number;
  /** List of discounts needing adjustment */
  adjustments: CascadeFixAdjustment[];
  /** Total adjustment amount (sum of all individual adjustments) */
  totalAdjustment: number;
}

/** Form state for cascade fix action */
export interface CascadeFixFormState {
  success?: boolean;
  message?: string;
  totalAdjustment?: number;
}
