// Actions
export {
  createDiscountTypeAction,
  updateDiscountTypeAction,
  deleteDiscountTypeAction,
  createDiscountRequestAction,
  approveDiscountRequestAction,
  rejectDiscountRequestAction,
  bulkApproveDiscountsAction,
  cancelDiscountRequestAction,
  reverseDiscountAction,
  applyApprovedDiscountsToAssessment,
} from "./discounts.actions";

// Queries
export {
  getActiveDiscountTypes,
  getAllDiscountTypes,
  getDiscountTypeById,
  getPendingDiscountRequests,
  getDiscountRequestsByEnrollment,
  hasPendingDiscountRequests,
  getApprovedDiscountRequestsForEnrollment,
  getStudentDiscountsByAssessment,
  getAssessmentItemsWithFeeTypes,
  getDiscountRequestCounts,
  getDiscountRequestsHistory,
} from "./discounts.queries";

// Schemas
export {
  createDiscountTypeSchema,
  updateDiscountTypeSchema,
  createDiscountRequestSchema,
  approveDiscountRequestSchema,
  rejectDiscountRequestSchema,
  bulkApproveDiscountsSchema,
  cancelDiscountRequestSchema,
  reverseDiscountSchema,
  discountRequestFiltersSchema,
  discountCalculationTypeSchema,
  discountBaseTypeSchema,
  discountRequestStatusSchema,
} from "./discounts.schema";

// Types
export type {
  CreateDiscountTypeInput,
  CreateDiscountTypeFormState,
  UpdateDiscountTypeInput,
  UpdateDiscountTypeFormState,
  CreateDiscountRequestInput,
  CreateDiscountRequestFormState,
  ApproveDiscountRequestInput,
  ApproveDiscountRequestFormState,
  RejectDiscountRequestInput,
  RejectDiscountRequestFormState,
  BulkApproveDiscountsInput,
  BulkApproveDiscountsFormState,
  CancelDiscountRequestInput,
  CancelDiscountRequestFormState,
  ReverseDiscountInput,
  ReverseDiscountFormState,
  DiscountRequestFilters,
  DiscountCalculationType,
  DiscountBaseType,
  DiscountRequestStatus,
  DiscountTypeView,
  DiscountRequestView,
  StudentDiscountView,
} from "./discounts.schema";

// Utilities
export {
  calculateDiscountBase,
  calculateDiscountAmount,
  calculateTotalDiscounts,
  sumDiscountLines,
  formatDiscountDescription,
  validateDiscountLine,
} from "./utils/discount-calculations";

export type {
  CalculationAssessmentItem,
  DiscountTypeConfig,
  ApprovedDiscountRequest,
  DiscountLine,
} from "./utils/discount-calculations";
