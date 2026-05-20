import 'server-only';
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  studentGuardianLinks,
  parentsGuardians,
} from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { resolveFeeScheduleForAssessment } from "./assessments.queries";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/constants/assessment-bands";
import {
  calculateDiscountBase,
  calculateDiscountAmount,
} from "@/features/discounts/utils/discount-calculations";
import type { DiscountRequestView } from "@/features/discounts/discounts.schema";

export type NewAssessmentFeeCatalogEntry = {
  feeTemplateItemId: string; // Changed from feeScheduleItemId
  feeItemTypeId: string;     // New: For reporting
  feeItemTypeCode: string;   // New: For discount base calculation (e.g., 'TUITION')
  description: string;
  defaultAmount: string;
  isDiscount: boolean;
};

export type NewAssessmentEnrollmentContext = {
  enrollmentId: string;
  enrollmentStatus: (typeof enrollments.$inferSelect)["status"];
  studentId: string;
  firstName: string;
  lastName: string;
  referenceNumber: string;
  schoolYearId: string;
  gradeLevelId: string;
  syLabel: string;
  gradeName: string;
  assessmentBand: (typeof gradeLevels.$inferSelect)["assessmentBand"];
};

export type NewAssessmentPageReadyContext = {
  status: "ready";
  enrollment: NewAssessmentEnrollmentContext;
  catalogBandLabel: string;
  primaryGuardianLabel: string | null;
  feeCatalog: NewAssessmentFeeCatalogEntry[];
  submitBlockedReason: string | null;
};

export type NewAssessmentPageBlockedContext = {
  status: "not_pending";
  reason: "not_pending";
};

/** Pre-calculated discount amount for display in the assessment draft */
export type CalculatedDiscountPreview = {
  discountRequestId: string;
  discountTypeName: string;
  calculationType: "fixed_amount" | "percentage";
  displayValue: string; // e.g., "15%" or "9000"
  baseAmount: number;
  calculatedAmount: number;
};

/** Summary of expected discounts for the assessment draft */
export type ExpectedDiscountsSummary = {
  items: CalculatedDiscountPreview[];
  totalExpectedDiscounts: number;
};

/**
 * Calculate expected discount amounts for approved discount requests.
 * This is called on the server to avoid business logic in UI components.
 */
export function calculateExpectedDiscounts(
  feeCatalog: NewAssessmentFeeCatalogEntry[],
  approvedRequests: DiscountRequestView[]
): ExpectedDiscountsSummary {
  // Build items for discount calculation
  const itemsForCalc = feeCatalog.map((item) => ({
    id: item.feeTemplateItemId,
    amount: Number(item.defaultAmount),
    isDiscount: item.isDiscount,
    feeItemTypeCode: item.feeItemTypeCode,
  }));

  const items: CalculatedDiscountPreview[] = [];
  let totalExpectedDiscounts = 0;

  for (const req of approvedRequests) {
    const baseAmount = calculateDiscountBase(itemsForCalc, req.baseType);
    const discountValue = req.overrideValue
      ? Number(req.overrideValue)
      : Number(req.defaultValue);
    const calculatedAmount = calculateDiscountAmount(
      baseAmount,
      req.calculationType,
      discountValue
    );

    items.push({
      discountRequestId: req.id,
      discountTypeName: req.discountTypeName,
      calculationType: req.calculationType,
      displayValue: req.overrideValue ?? req.defaultValue,
      baseAmount,
      calculatedAmount,
    });

    totalExpectedDiscounts += calculatedAmount;
  }

  return { items, totalExpectedDiscounts };
}

/**
 * Loads enrollment, fee catalog, and optional primary guardian for the new-assessment page.
 */
export async function loadNewAssessmentPageContext(
  enrollmentId: string
): Promise<NewAssessmentPageReadyContext | NewAssessmentPageBlockedContext | null> {
  const row = await db
    .select({
      enrollmentId: enrollments.id,
      enrollmentStatus: enrollments.status,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      schoolYearId: enrollments.schoolYearId,
      gradeLevelId: enrollments.gradeLevelId,
      syLabel: schoolYears.label,
      gradeName: gradeLevels.name,
      assessmentBand: gradeLevels.assessmentBand,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (row.length === 0) return null;

  const e = row[0];
  if (e.enrollmentStatus !== "pending") {
    return {
      status: "not_pending",
      reason: "not_pending",
    };
  }

  const primaryRow = await db
    .select({
      firstName: parentsGuardians.firstName,
      lastName: parentsGuardians.lastName,
      isPrimary: studentGuardianLinks.isPrimary,
    })
    .from(studentGuardianLinks)
    .innerJoin(parentsGuardians, eq(studentGuardianLinks.guardianId, parentsGuardians.id))
    .where(eq(studentGuardianLinks.studentId, e.studentId))
    .orderBy(desc(studentGuardianLinks.isPrimary), asc(studentGuardianLinks.createdAt))
    .limit(1);

  const primaryGuardianLabel =
    primaryRow[0] != null
      ? `${primaryRow[0].lastName}, ${primaryRow[0].firstName}`
      : null;

  const catalogBandLabel = FEE_ASSESSMENT_BAND_LABELS[e.assessmentBand];

  const feeResolution = await resolveFeeScheduleForAssessment(db, {
    schoolYearId: e.schoolYearId,
    assessmentBand: e.assessmentBand,
  });

  let feeCatalog: NewAssessmentFeeCatalogEntry[] = [];

  if (feeResolution) {
    feeCatalog = feeResolution.items.map((item) => ({
      feeTemplateItemId: item.feeTemplateItemId, // Changed from feeScheduleItemId
      feeItemTypeId: item.feeItemTypeId,         // New: For reporting
      feeItemTypeCode: item.feeItemTypeCode,     // New: For discount base calculation
      description: item.description,
      defaultAmount: item.amount,
      isDiscount: item.isDiscount,
    }));
  }

  const submitBlockedReason = !feeResolution
    ? `No fee schedule exists for this school year and fee band (${catalogBandLabel}). Create one under Finance → Fee Templates with line items.`
    : feeCatalog.length === 0
      ? `Add at least one fee to the template for this grade band (${catalogBandLabel}) under Finance → Fee Templates before assessing.`
      : null;

  return {
    status: "ready",
    enrollment: {
      enrollmentId: e.enrollmentId,
      enrollmentStatus: e.enrollmentStatus,
      studentId: e.studentId,
      firstName: e.firstName,
      lastName: e.lastName,
      referenceNumber: e.referenceNumber,
      schoolYearId: e.schoolYearId,
      gradeLevelId: e.gradeLevelId,
      syLabel: e.syLabel,
      gradeName: e.gradeName,
      assessmentBand: e.assessmentBand,
    },
    catalogBandLabel,
    primaryGuardianLabel,
    feeCatalog,
    submitBlockedReason,
  };
}
