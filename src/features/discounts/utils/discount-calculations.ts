/**
 * Discount calculation utilities
 *
 * Key concepts:
 * - `tuition_only`: Discount applies to sum of items where feeItemType.code = 'TUITION'
 * - `full_assessment`: Discount applies to total assessment amount (all non-discount items)
 *
 * Example:
 *   Tuition: 50,000 | Other fees: 7,000 | Total: 57,000
 *   ESC 20% (tuition_only) = 20% × 50,000 = 10,000
 *   Employee 5% (full_assessment) = 5% × 57,000 = 2,850
 */

/** Assessment item with fee type info for calculation */
export interface CalculationAssessmentItem {
  id: string;
  amount: string | number;
  isDiscount: boolean;
  /** Fee item type code (e.g., 'TUITION', 'LAB_FEE') */
  feeItemTypeCode?: string | null;
}

/** Discount type configuration */
export interface DiscountTypeConfig {
  code: string;
  name: string;
  calculationType: "fixed_amount" | "percentage";
  baseType: "tuition_only" | "full_assessment";
  defaultValue: string | number;
}

/** Approved discount request with discount type info */
export interface ApprovedDiscountRequest {
  id: string;
  discountTypeId: string;
  overrideValue?: string | number | null;
  discountType: DiscountTypeConfig;
}

/** Computed discount line for application */
export interface DiscountLine {
  discountRequestId: string;
  discountTypeCode: string;
  discountTypeName: string;
  baseType: "tuition_only" | "full_assessment";
  baseAmount: number;
  calculationType: "fixed_amount" | "percentage";
  discountValue: number;
  discountAmount: number;
}

/**
 * Calculate the base amount for a discount based on its base type
 *
 * @param assessmentItems - List of assessment items (fees)
 * @param baseType - Whether to use tuition only or full assessment
 * @returns The base amount in pesos
 */
export function calculateDiscountBase(
  assessmentItems: CalculationAssessmentItem[],
  baseType: "tuition_only" | "full_assessment"
): number {
  // Filter out existing discount lines
  const nonDiscountItems = assessmentItems.filter((item) => !item.isDiscount);

  if (baseType === "full_assessment") {
    // Sum all non-discount items
    return nonDiscountItems.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
  }

  // tuition_only: Sum items where fee type code is 'TUITION'
  return nonDiscountItems
    .filter((item) => item.feeItemTypeCode === "TUITION")
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

/**
 * Calculate the discount amount based on calculation type and value
 *
 * @param baseAmount - The base amount to calculate discount from
 * @param calculationType - fixed_amount or percentage
 * @param discountValue - The discount value (percentage number or peso amount)
 * @returns The discount amount in pesos (never exceeds base amount)
 */
export function calculateDiscountAmount(
  baseAmount: number,
  calculationType: "fixed_amount" | "percentage",
  discountValue: number
): number {
  if (baseAmount <= 0) {
    return 0;
  }

  if (calculationType === "percentage") {
    const amount = (baseAmount * discountValue) / 100;
    // Cap percentage-based discounts at 100% of base
    return Math.min(amount, baseAmount);
  }

  // Fixed amount - cannot exceed base
  return Math.min(discountValue, baseAmount);
}

/**
 * Calculate all discount lines for a set of approved requests
 *
 * Multiple discounts are additive - each calculates against its configured base
 * (not the remaining amount after previous discounts)
 *
 * @param assessmentItems - List of assessment items (fees)
 * @param approvedRequests - List of approved discount requests with discount type info
 * @returns Array of computed discount lines ready for application
 */
export function calculateTotalDiscounts(
  assessmentItems: CalculationAssessmentItem[],
  approvedRequests: ApprovedDiscountRequest[]
): DiscountLine[] {
  return approvedRequests.map((request) => {
    const { discountType } = request;

    // Calculate base amount for this discount's base type
    const baseAmount = calculateDiscountBase(
      assessmentItems,
      discountType.baseType
    );

    // Use override value if provided, otherwise use default
    const discountValue = request.overrideValue
      ? Number(request.overrideValue)
      : Number(discountType.defaultValue);

    // Calculate the actual discount amount
    const discountAmount = calculateDiscountAmount(
      baseAmount,
      discountType.calculationType,
      discountValue
    );

    return {
      discountRequestId: request.id,
      discountTypeCode: discountType.code,
      discountTypeName: discountType.name,
      baseType: discountType.baseType,
      baseAmount,
      calculationType: discountType.calculationType,
      discountValue,
      discountAmount,
    };
  });
}

/**
 * Calculate the total discount sum from discount lines
 *
 * @param discountLines - Array of computed discount lines
 * @returns Total discount amount in pesos
 */
export function sumDiscountLines(discountLines: DiscountLine[]): number {
  return discountLines.reduce((sum, line) => sum + line.discountAmount, 0);
}

/**
 * Format discount description for assessment item
 *
 * Example: "ESC 20% Discount (on P50,000 tuition)"
 *
 * @param line - The discount line to format
 * @returns Formatted description string
 */
export function formatDiscountDescription(line: DiscountLine): string {
  const baseLabel =
    line.baseType === "tuition_only" ? "tuition" : "full assessment";
  const formattedBase = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(line.baseAmount);

  return `${line.discountTypeName} (on ${formattedBase} ${baseLabel})`;
}

/**
 * Validate that a discount can be applied
 *
 * @param discountLine - The computed discount line
 * @returns Object with isValid flag and optional error message
 */
export function validateDiscountLine(discountLine: DiscountLine): {
  isValid: boolean;
  error?: string;
} {
  if (discountLine.baseAmount <= 0) {
    return {
      isValid: false,
      error: `Cannot apply ${discountLine.discountTypeName}: no eligible base amount (${discountLine.baseType === "tuition_only" ? "no tuition fees found" : "no fees found"})`,
    };
  }

  if (discountLine.discountAmount <= 0) {
    return {
      isValid: false,
      error: `Cannot apply ${discountLine.discountTypeName}: discount value results in zero amount`,
    };
  }

  return { isValid: true };
}
