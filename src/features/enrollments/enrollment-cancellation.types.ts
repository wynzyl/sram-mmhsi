/**
 * Enrollment Cancellation feature type definitions
 *
 * Shared DTO types for enrollment cancellation-related queries and components.
 * These types are extracted from enrollment-cancellation.queries.ts for better
 * organization and reusability across the codebase.
 */

import type { CancellationReason } from "@/lib/constants/cancellation-reasons";

// ─────────────────────────────────────────────────────────────────
// Cancellation Request List Types
// ─────────────────────────────────────────────────────────────────

export type CancellationRequestListItem = {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  studentName: string;
  gradeLevelName: string;
  schoolYearLabel: string;
  reasonType: CancellationReason;
  remarks: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAt: Date;
  requestedByName: string;
  reviewedAt: Date | null;
  reviewedByName: string | null;
};

// ─────────────────────────────────────────────────────────────────
// Cancellation Request Detail Types
// ─────────────────────────────────────────────────────────────────

export type CancellationRequestDetail = CancellationRequestListItem & {
  enrollmentStatus: "pending" | "assessed" | "enrolled" | "cancelled";
  reviewRemarks: string | null;
  // Assessment info (if exists)
  assessment: {
    id: string;
    totalAmount: string;
    totalPaid: string;
    balance: string;
    billingStatus: string;
  } | null;
  // Refund calculation preview (computed)
  refundPreview: RefundCalculation | null;
};

// ─────────────────────────────────────────────────────────────────
// Refund Calculation Types
// ─────────────────────────────────────────────────────────────────

export type RefundCalculation = {
  isEligibleForRefund: boolean;
  cutoffDate: Date;
  refundableAmount: number;
  nonRefundableAmount: number;
  totalPaid: number;
  itemBreakdown: Array<{
    description: string;
    paidAmount: number;
    isRefundable: boolean;
    willRefund: boolean;
  }>;
};

// ─────────────────────────────────────────────────────────────────
// Pending Cancellation Request Types
// ─────────────────────────────────────────────────────────────────

export type PendingCancellationInfo = {
  id: string;
  requestedBy: string;
  requestedAt: Date;
  reasonType: string;
  remarks: string | null;
  requestedByName: string;
};

// ─────────────────────────────────────────────────────────────────
// Enrollment for Cancellation Types
// ─────────────────────────────────────────────────────────────────

export type EnrollmentForCancellation = {
  id: string;
  studentId: string;
  schoolYearId: string;
  status: string;
  assessment: {
    id: string;
    totalAmount: string;
    totalPaid: string;
    balance: string;
  } | null;
};

// ─────────────────────────────────────────────────────────────────
// Cancellation Request Validation Types
// ─────────────────────────────────────────────────────────────────

export type CancellationRequestForValidation = {
  id: string;
  enrollmentId: string;
  status: string;
  requestedBy: string;
};

// ─────────────────────────────────────────────────────────────────
// Cancellation History Types
// ─────────────────────────────────────────────────────────────────

export type CancellationHistoryItem = {
  id: string;
  reasonType: CancellationReason;
  remarks: string | null;
  status: string;
  requestedAt: Date;
  requestedByName: string;
  reviewedAt: Date | null;
  reviewedByName: string | null;
  reviewRemarks: string | null;
};
