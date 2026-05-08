import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  feeScheduleItems,
  studentGuardianLinks,
  parentsGuardians,
} from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { resolveFeeScheduleForAssessment } from "@/lib/fee-schedule/resolve";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";

export type NewAssessmentFeeCatalogEntry = {
  feeScheduleItemId: string;
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

  const schedule = await resolveFeeScheduleForAssessment(db, {
    schoolYearId: e.schoolYearId,
    assessmentBand: e.assessmentBand,
  });

  let feeCatalog: NewAssessmentFeeCatalogEntry[] = [];

  if (schedule) {
    const items = await db
      .select()
      .from(feeScheduleItems)
      .where(eq(feeScheduleItems.feeScheduleId, schedule.id))
      .orderBy(asc(feeScheduleItems.order), asc(feeScheduleItems.createdAt));

    feeCatalog = items.map((item) => ({
      feeScheduleItemId: item.id,
      description: item.description,
      defaultAmount: String(item.amount),
      isDiscount: item.isDiscount,
    }));
  }

  const submitBlockedReason = !schedule
    ? `No fee schedule exists for this school year and fee band (${catalogBandLabel}), or a legacy school-wide catalog. Create one under Finance → Fee schedules with line items.`
    : !schedule.isActive
      ? `The fee schedule for this grade band (${catalogBandLabel}) is inactive. Activate it in Finance before assessing.`
      : feeCatalog.length === 0
        ? `Add at least one fee to the catalog for this grade band (${catalogBandLabel}) under Finance → Fee schedules before assessing.`
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
