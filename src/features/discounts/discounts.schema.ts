import { z } from "zod";
import {
  uuidSchema,
  optionalTextSchema,
  amountSchema,
  nameSchema,
  type BaseFormState,
} from "@/lib/validators/common-schemas";

// ─── Discount Type Schemas ────────────────────────────────────────────────────

export const discountCalculationTypeSchema = z.enum(["fixed_amount", "percentage"]);
export type DiscountCalculationType = z.infer<typeof discountCalculationTypeSchema>;

export const discountBaseTypeSchema = z.enum(["tuition_only", "full_assessment"]);
export type DiscountBaseType = z.infer<typeof discountBaseTypeSchema>;

export const discountRequestStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled", "reversed"]);
export type DiscountRequestStatus = z.infer<typeof discountRequestStatusSchema>;

// ─── Create Discount Type Schema ──────────────────────────────────────────────

export const createDiscountTypeSchema = z.object({
  code: z
    .string()
    .min(1, "Code is required.")
    .max(50, "Code must be 50 characters or less.")
    .regex(
      /^[A-Z0-9_]+$/,
      "Code must be uppercase letters, numbers, and underscores only."
    )
    .trim(),
  name: nameSchema.pipe(z.string().max(100, "Name must be 100 characters or less.")),
  description: optionalTextSchema,
  calculationType: discountCalculationTypeSchema,
  baseType: discountBaseTypeSchema,
  defaultValue: amountSchema.pipe(
    z.number().max(999999999.99, "Value exceeds maximum allowed.")
  ),
  isActive: z.coerce.boolean().default(true),
  requiresDocumentation: z.coerce.boolean().default(true),
  isStackable: z.coerce.boolean().default(true),
  displayOrder: z.coerce.number().int().nonnegative().default(0),
});

export type CreateDiscountTypeInput = z.infer<typeof createDiscountTypeSchema>;
export type CreateDiscountTypeFormState = BaseFormState<CreateDiscountTypeInput> & {
  discountTypeId?: string;
};

// ─── Update Discount Type Schema ──────────────────────────────────────────────

export const updateDiscountTypeSchema = createDiscountTypeSchema.extend({
  id: uuidSchema,
});

export type UpdateDiscountTypeInput = z.infer<typeof updateDiscountTypeSchema>;
export type UpdateDiscountTypeFormState = BaseFormState<UpdateDiscountTypeInput>;

// ─── Create Discount Request Schema ───────────────────────────────────────────

export const createDiscountRequestSchema = z.object({
  studentId: uuidSchema,
  enrollmentId: uuidSchema,
  discountTypeId: uuidSchema,
  requestReason: optionalTextSchema.pipe(
    z.string().max(500, "Reason must be 500 characters or less.").optional()
  ),
});

export type CreateDiscountRequestInput = z.infer<typeof createDiscountRequestSchema>;
export type CreateDiscountRequestFormState = BaseFormState<CreateDiscountRequestInput> & {
  discountRequestId?: string;
};

// ─── Approve Discount Request Schema ──────────────────────────────────────────

export const approveDiscountRequestSchema = z.object({
  discountRequestId: uuidSchema,
  overrideValue: z.coerce
    .number()
    .positive("Override value must be positive.")
    .max(999999999.99, "Value exceeds maximum allowed.")
    .optional()
    .nullable(),
  overrideReason: optionalTextSchema.pipe(
    z.string().max(500, "Reason must be 500 characters or less.").optional()
  ),
  decisionRemarks: optionalTextSchema.pipe(
    z.string().max(500, "Remarks must be 500 characters or less.").optional()
  ),
});

export type ApproveDiscountRequestInput = z.infer<typeof approveDiscountRequestSchema>;
export type ApproveDiscountRequestFormState = BaseFormState<ApproveDiscountRequestInput>;

// ─── Reject Discount Request Schema ───────────────────────────────────────────

export const rejectDiscountRequestSchema = z.object({
  discountRequestId: uuidSchema,
  decisionRemarks: z
    .string()
    .trim()
    .min(1, "Rejection reason is required.")
    .max(500, "Remarks must be 500 characters or less."),
});

export type RejectDiscountRequestInput = z.infer<typeof rejectDiscountRequestSchema>;
export type RejectDiscountRequestFormState = BaseFormState<RejectDiscountRequestInput>;

// ─── Bulk Approve Schema ──────────────────────────────────────────────────────

export const bulkApproveDiscountsSchema = z.object({
  discountRequestIds: z
    .array(uuidSchema)
    .min(1, "At least one discount request must be selected."),
  decisionRemarks: optionalTextSchema.pipe(
    z.string().max(500, "Remarks must be 500 characters or less.").optional()
  ),
});

export type BulkApproveDiscountsInput = z.infer<typeof bulkApproveDiscountsSchema>;
export type BulkApproveDiscountsFormState = BaseFormState<BulkApproveDiscountsInput> & {
  approvedCount?: number;
  failedCount?: number;
};

// ─── Cancel Discount Request Schema ───────────────────────────────────────────

export const cancelDiscountRequestSchema = z.object({
  discountRequestId: uuidSchema,
});

export type CancelDiscountRequestInput = z.infer<typeof cancelDiscountRequestSchema>;
export type CancelDiscountRequestFormState = BaseFormState<CancelDiscountRequestInput>;

// ─── Reverse Discount Schema ──────────────────────────────────────────────────

export const reverseDiscountSchema = z.object({
  studentDiscountId: uuidSchema,
  reversalRemarks: z
    .string()
    .trim()
    .min(1, "Reversal reason is required.")
    .max(500, "Remarks must be 500 characters or less."),
});

export type ReverseDiscountInput = z.infer<typeof reverseDiscountSchema>;
export type ReverseDiscountFormState = BaseFormState<ReverseDiscountInput> & {
  reversalDiscountId?: string;
};

// ─── Apply Approved Discount To Existing Assessment Schema ────────────────────

export const applyApprovedDiscountSchema = z.object({
  discountRequestId: uuidSchema,
});

export type ApplyApprovedDiscountInput = z.infer<typeof applyApprovedDiscountSchema>;
export type ApplyApprovedDiscountFormState = BaseFormState<ApplyApprovedDiscountInput> & {
  studentDiscountId?: string;
  discountAmount?: number;
};

// ─── Query/Filter Schemas ─────────────────────────────────────────────────────

export const discountRequestFiltersSchema = z.object({
  status: discountRequestStatusSchema.optional(),
  schoolYearId: uuidSchema.optional(),
  gradeLevelId: uuidSchema.optional(),
  searchQuery: optionalTextSchema,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type DiscountRequestFilters = z.infer<typeof discountRequestFiltersSchema>;

// ─── Response Types ───────────────────────────────────────────────────────────

/** Discount type for display */
export interface DiscountTypeView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  calculationType: DiscountCalculationType;
  baseType: DiscountBaseType;
  defaultValue: string;
  isActive: boolean;
  requiresDocumentation: boolean;
  isStackable: boolean;
  displayOrder: number;
  createdAt: Date;
}

/** Discount request for queue display */
export interface DiscountRequestView {
  id: string;
  studentId: string;
  studentName: string;
  studentRef: string;
  enrollmentId: string;
  gradeLevelName: string;
  schoolYearLabel: string;
  discountTypeId: string;
  discountTypeCode: string;
  discountTypeName: string;
  calculationType: DiscountCalculationType;
  baseType: DiscountBaseType;
  defaultValue: string;
  requestReason: string | null;
  status: DiscountRequestStatus;
  requestedBy: string;
  requestedByName: string;
  requestedAt: Date;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  decisionRemarks: string | null;
  overrideValue: string | null;
  overrideReason: string | null;
  /** Null until the discount has been applied to an assessment */
  assessmentId: string | null;
  /** Whether the parent enrollment already has a finalized assessment */
  enrollmentHasAssessment: boolean;
  /** Applied discount amount (null if not yet applied) */
  appliedDiscountAmount?: string | null;
  /** Assessment billing status (null if not yet applied) */
  assessmentBillingStatus?: string | null;
}

/** Applied student discount for display */
export interface StudentDiscountView {
  id: string;
  studentId: string;
  assessmentId: string;
  /** Parent enrollment id; used by UI to link back to the enrollment view. */
  enrollmentId: string;
  discountRequestId: string;
  discountTypeCode: string;
  discountTypeName: string;
  calculationType: DiscountCalculationType;
  baseType: DiscountBaseType;
  baseAmount: string;
  discountValue: string;
  discountAmount: string;
  appliedAt: Date;
  appliedByName: string;
  reversedAt: Date | null;
  reversedByName: string | null;
  reversalRemarks: string | null;
  /** True if a replacement request has already been issued for this reversed row. */
  hasReplacement: boolean;
}
