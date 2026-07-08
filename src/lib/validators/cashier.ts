/**
 * Cashier / receipt-booklet validators.
 *
 * Single source of truth lives in `@/features/payments/payments.schema`.
 * This module re-exports those schemas so existing importers of
 * `@/lib/validators/cashier` keep working without duplicating (and drifting
 * from) the canonical definitions.
 */
export {
  BOOKLET_USAGE_MODES,
  CreateBookletSchema,
  PostPaymentSchema,
  VoidPaymentSchema,
  formatBookletSeriesCanonical,
  normalizeBookletSeriesInput,
} from "@/features/payments/payments.schema";

export type {
  BookletUsageMode,
  CreateBookletInput,
  BookletFormState,
  PostPaymentInput,
  PaymentFormState,
  VoidPaymentInput,
  VoidPaymentFormState,
} from "@/features/payments/payments.schema";
