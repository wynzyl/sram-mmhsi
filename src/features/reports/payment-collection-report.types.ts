// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentCollectionRow = {
  id: string;
  orNumber: string;
  collectionDate: Date;
  studentId: string;
  studentName: string; // "DELA CRUZ, Juan"
  studentRef: string; // "SRAMS-2026-00001"
  gradeLevel: string; // "Grade 7"
  schoolYear: string; // "2025-2026"
  amount: string;
  paymentMethod: string; // cash, gcash, bank_transfer, check, other
  referenceNumber: string | null;
  status: string;
  kind: string;
  remarks: string | null;
  processedBy: string; // cashier username
  usageMode: "auto_only" | "manual_only" | null; // booklet usage mode
};

export type PaymentMethodBreakdown = {
  cash: number;
  gcash: number;
  bank_transfer: number;
  check: number;
  other: number;
};

export type PaymentCollectionSummary = {
  totalCount: number;
  totalAmount: number;
  byMethod: PaymentMethodBreakdown;
  periodStart: Date;
  periodEnd: Date;
};

export type PaymentCollectionParams = {
  startDate: Date;
  endDate: Date;
  schoolYearId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  usageMode?: string;
  page?: number;
  pageSize?: number;
};

export type PaymentCollectionResult = {
  rows: PaymentCollectionRow[];
  totalCount: number;
};

// ─── Payment method labels ───────────────────────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  bank_transfer: "Bank Transfer",
  check: "Check",
  other: "Other",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  posted: "Posted",
  pending_confirmation: "Pending",
  reversed: "Reversed",
  reversal: "Reversal",
};

export const USAGE_MODE_LABELS: Record<string, string> = {
  auto_only: "Auto",
  manual_only: "Manual",
};
