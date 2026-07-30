"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { StepHeader } from "./wizard-utils";
import IntakeRequirementsFieldset, { type IntakePreserved } from "./IntakeRequirementsFieldset";
import { cn } from "@/lib/utils/cn";
import type { PlacementType } from "./PlacementPreviewCard";
import type { EnrollmentFormState } from "../enrollments.schema";
import { TYPE_LABEL } from "../wizard.types";

export interface WizardStepIntakeAndReviewProps {
  showIntake: boolean;
  intakePreserved: IntakePreserved | undefined;
  errors?: EnrollmentFormState["errors"];
  selectedStudentName: string | null;
  referenceNumber: string | null;
  schoolYearLabel: string | null;
  gradeLevelName: string | null;
  studentType: PlacementType;
  previousSchool: string | null;
}

/**
 * Step 3: Intake document checklist (for new/transferee) + final review summary.
 */
export default function WizardStepIntakeAndReview({
  showIntake,
  intakePreserved,
  errors,
  selectedStudentName,
  referenceNumber,
  schoolYearLabel,
  gradeLevelName,
  studentType,
  previousSchool,
}: WizardStepIntakeAndReviewProps) {
  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Step 03 / Confirm"
        title="Intake & final review"
        description="Set the document checklist (when applicable), confirm the placement, and create the enrollment."
        icon={<ClipboardCheck className="h-5 w-5" />}
      />

      {showIntake ? (
        <IntakeRequirementsFieldset
          key={`intake-${selectedStudentName ?? "none"}-${studentType}`}
          errors={errors}
          preserved={intakePreserved}
          legend="Requirements (new / transferee)"
          description={
            <>
              Set each item to <strong>Received</strong>, <strong>Not applicable</strong>, or{" "}
              <strong>To follow</strong> when documents are still pending. Voucher and ESC certificates
              are optional per learner.
            </>
          }
        />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-100/50 p-5">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Returning learners</strong> reuse intake records from
            their original registration — no new checklist required.
          </p>
        </div>
      )}

      <ReviewSummary
        selectedStudentName={selectedStudentName}
        referenceNumber={referenceNumber}
        schoolYearLabel={schoolYearLabel}
        gradeLevelName={gradeLevelName}
        studentType={studentType}
        previousSchool={previousSchool}
      />

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-foreground">
          The enrollment will be created as <strong>Pending</strong>. The next step in the workflow is
          building the assessment — fees and the official receipt are recorded separately by the
          finance officer and cashier.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal component for final review summary
// ─────────────────────────────────────────────────────────────────────────────

function ReviewSummary({
  selectedStudentName,
  referenceNumber,
  schoolYearLabel,
  gradeLevelName,
  studentType,
  previousSchool,
}: {
  selectedStudentName: string | null;
  referenceNumber: string | null;
  schoolYearLabel: string | null;
  gradeLevelName: string | null;
  studentType: PlacementType;
  previousSchool: string | null;
}) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Student", value: selectedStudentName ?? "—" },
    { label: "Student ID", value: referenceNumber ?? "—" },
    { label: "School Year", value: schoolYearLabel ?? "—" },
    { label: "Grade Level", value: gradeLevelName ?? "—" },
    { label: "Type", value: TYPE_LABEL[studentType] },
  ];
  if (studentType === "transferee" && previousSchool) {
    rows.push({ label: "Previous School", value: previousSchool });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <h3 className="font-display text-base font-bold text-foreground">
          Confirm placement before saving
        </h3>
      </div>
      <dl className="divide-y divide-gray-100">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-3 gap-4 px-5 py-3 text-sm"
          >
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {row.label}
            </dt>
            <dd
              className={cn(
                "col-span-2 text-foreground",
                row.label === "Student ID" && "font-mono",
                row.label === "Student" && "font-display text-base font-semibold uppercase"
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
