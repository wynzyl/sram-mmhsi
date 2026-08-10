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
    /** Cascade adjustments that were triggered (if any) */
    cascadeAdjustments: AppliedCascadeAdjustment[];
    /** Total cascade adjustment amount */
    totalCascadeAdjustment: number;
  };
}
