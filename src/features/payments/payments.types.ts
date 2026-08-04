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
    /** New balance after discount is applied */
    newBalance: number;
    /** Amount the cashier should collect */
    paymentRequired: number;
    /** Cutoff date for the school year */
    cutoffDate: Date;
  };
}
