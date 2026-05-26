import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentDraftForm from "@/features/assessments/components/AssessmentDraftForm";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
import { loadNewAssessmentPageContext, calculateExpectedDiscounts } from "@/features/assessments";
import { getDiscountRequestsByEnrollment } from "@/features/discounts";

export async function InternalNewAssessmentForEnrollmentPage(props: {
  enrollmentId: string;
  assessmentsBasePath: "/staff/assessments";
}) {
  const { enrollmentId, assessmentsBasePath } = props;
  const session = await requireSession();
  if (!hasPermission(session.role, "assessments:create")) {
    redirect(assessmentsBasePath);
  }

  const ctx = await loadNewAssessmentPageContext(enrollmentId);
  if (!ctx) notFound();
  if (ctx.status === "not_pending") {
    redirect(assessmentsBasePath);
  }

  const { enrollment: e, catalogBandLabel, primaryGuardianLabel, feeCatalog, submitBlockedReason } =
    ctx;

  // Fetch existing discount requests for this enrollment
  const existingDiscountRequests = await getDiscountRequestsByEnrollment(enrollmentId);

  // Check if user can review/approve discounts
  const canReviewDiscounts = hasPermission(session.role, "discounts:review");

  // Calculate expected discounts on the server (business logic stays server-side)
  const approvedRequests = existingDiscountRequests.filter((r) => r.status === "approved");
  const expectedDiscounts = calculateExpectedDiscounts(feeCatalog, approvedRequests);

  return (
    <div className="page-container max-w-7xl">
      <SectionHeader
        size="md"
        accent
        title="Fee assessment"
        subtitle={
          <>
            One-time fee snapshot for this enrollment. Saving creates the assessment and moves the
            enrollment to <strong>Assessed</strong>. Adjust catalog lines and amounts below; discounts
            come from fee schedule lines marked as discount.
            <span className="mt-2 block text-sm text-muted-foreground">
              Academic period: <strong>{e.syLabel}</strong> · Fee band:{" "}
              <strong>{catalogBandLabel}</strong>
            </span>
          </>
        }
      />

      <AssessmentDraftForm
        enrollmentId={e.enrollmentId}
        studentFirstName={e.firstName}
        studentLastName={e.lastName}
        referenceNumber={e.referenceNumber}
        schoolYearLabel={e.syLabel}
        gradeLabel={e.gradeName}
        catalogBandLabel={catalogBandLabel}
        enrollmentStatus={e.enrollmentStatus}
        primaryGuardianLabel={primaryGuardianLabel}
        feeCatalog={feeCatalog}
        submitBlockedReason={submitBlockedReason}
        assessmentsBasePath={assessmentsBasePath}
        feeSchedulesPath="/staff/finance/fee-schedules"
        existingDiscountRequests={existingDiscountRequests}
        canReviewDiscounts={canReviewDiscounts}
        expectedDiscounts={expectedDiscounts}
      />
    </div>
  );
}
