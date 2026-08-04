/**
 * Void Request feature type definitions
 *
 * Shared DTO types for void request-related queries and components.
 * These types are extracted from void-requests.queries.ts for better organization
 * and reusability across the codebase.
 */

// ─────────────────────────────────────────────────────────────────
// Pending Void Request Types
// ─────────────────────────────────────────────────────────────────

export type PendingVoidRequest = {
  id: string;
  paymentId: string;
  orNumber: string | null;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  studentId: string;
  studentName: string;
  studentRef: string;
  requestReason: string;
  requestedBy: string;
  requestedByUsername: string;
  requestedAt: string;
};

// ─────────────────────────────────────────────────────────────────
// Void Request History Types
// ─────────────────────────────────────────────────────────────────

export type VoidRequestHistoryRow = {
  id: string;
  paymentId: string;
  orNumber: string | null;
  amount: string;
  studentName: string;
  studentRef: string;
  status: string;
  requestReason: string;
  requestedByUsername: string;
  requestedAt: string;
  decidedByUsername: string | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
  cancelledAt: string | null;
};

// ─────────────────────────────────────────────────────────────────
// Void Request Summary Types
// ─────────────────────────────────────────────────────────────────

export type VoidRequestSummary = {
  requestId: string;
  requestedBy: string;
  requestedByUsername: string;
  requestedAt: string;
  status: string;
};

// ─────────────────────────────────────────────────────────────────
// Void Request Detail Types (for getVoidRequestById)
// ─────────────────────────────────────────────────────────────────

export type VoidRequestDetail = {
  id: string;
  paymentId: string;
  requestReason: string;
  status: string;
  requestedBy: string;
  requestedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionRemarks: string | null;
  cancelledAt: Date | null;
  // Payment info
  orNumber: string | null;
  amount: string;
  paymentMethod: string;
  paymentDate: Date;
  paymentStatus: string;
  // Student info
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  studentRef: string;
  // Assessment info
  assessmentId: string | null;
  assessmentBalance: string | null;
  // User info
  requestedByUsername: string | null;
  decidedByUsername: string | null;
};
