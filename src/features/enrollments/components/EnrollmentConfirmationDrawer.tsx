"use client";

import { useActionState, useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, FileText, User, GraduationCap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { confirmEnrollmentAction } from "../enrollment-confirmation.actions";
import { formatCurrency } from "@/lib/utils/currency";
import type { ConfirmEnrollmentFormState } from "../enrollments.schema";
import type { ReadyToEnrollStudent } from "../enrollments-queue.queries";

type EnrollmentConfirmationDrawerProps = {
  student: ReadyToEnrollStudent;
  schoolYearId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (enrollmentId: string) => void;
  sections?: Array<{ id: string; name: string }>;
};

const initialState: ConfirmEnrollmentFormState = {};

export default function EnrollmentConfirmationDrawer({
  student,
  schoolYearId,
  isOpen,
  onClose,
  onSuccess,
  sections = [],
}: EnrollmentConfirmationDrawerProps) {
  const [state, action, isPending] = useActionState(confirmEnrollmentAction, initialState);
  const [selectedSection, setSelectedSection] = useState<string>("");

  // Handle successful enrollment
  useEffect(() => {
    if (state.success && state.enrollmentId) {
      onSuccess?.(state.enrollmentId);
      onClose();
    }
  }, [state.success, state.enrollmentId, onSuccess, onClose]);

  // Reset section when drawer opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSection("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isNewOrTransferee = student.studentType === "new_student" || student.studentType === "transferee";
  const isOldStudent = student.studentType === "old_student";
  const gradeLevelId = isOldStudent ? student.suggestedGradeLevelId : student.registrationGradeLevelId;
  const gradeLevelName = isOldStudent ? student.suggestedGradeName : student.registrationGradeName;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto bg-[var(--color-surface)] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                {isOldStudent ? "Re-Enrollment Confirmation" : "Enrollment Confirmation"}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--color-text)]">
                {student.lastName}, {student.firstName}
              </h2>
              <p className="mt-0.5 font-mono text-xs text-[var(--color-text-muted)]">{student.studentRef}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isPending}
              className="rounded-full p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form action={action} className="px-6 py-6">
          {/* Hidden Fields */}
          <input type="hidden" name="studentId" value={student.studentId} />
          <input type="hidden" name="schoolYearId" value={schoolYearId} />
          <input type="hidden" name="gradeLevelId" value={gradeLevelId ?? ""} />
          <input type="hidden" name="studentType" value={student.studentType} />
          {student.registrationId && (
            <input type="hidden" name="registrationId" value={student.registrationId} />
          )}

          {/* Alert Messages */}
          <FormStateAlert state={state} />

          {/* Student Type Badge */}
          <div className="mb-6">
            <Badge
              variant={
                student.studentType === "new_student"
                  ? "info"
                  : student.studentType === "transferee"
                    ? "secondary"
                    : "success"
              }
            >
              {student.studentType === "new_student" && "New Student"}
              {student.studentType === "transferee" && "Transferee"}
              {student.studentType === "old_student" && "Returning Student"}
            </Badge>
          </div>

          {/* Enrollment Details Section */}
          <div className="mb-6 space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-2)]">
              <GraduationCap className="h-4 w-4" />
              Enrollment Details
            </h3>

            <div className="grid gap-3">
              {isOldStudent && (
                <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-2">
                  <span className="text-sm text-[var(--color-text-muted)]">Previous Grade</span>
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {student.previousGradeName}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-sm text-[var(--color-text-muted)]">
                  {isOldStudent ? "Promoting to" : "Enrolling Grade"}
                </span>
                <span className="text-sm font-semibold text-[var(--color-primary)]">{gradeLevelName}</span>
              </div>

              {student.studentType === "transferee" && student.registrationId && (
                <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-2">
                  <span className="text-sm text-[var(--color-text-muted)]">Registration ID</span>
                  <span className="font-mono text-xs text-[var(--color-text)]">
                    {student.registrationId.slice(0, 8)}...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Document Status (for new/transferee) */}
          {isNewOrTransferee && student.intakeDocuments && (
            <div className="mb-6 space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-2)]">
                <FileText className="h-4 w-4" />
                Document Checklist
              </h3>

              <div className="space-y-2">
                {Object.entries({
                  "Form 138": student.intakeDocuments.form138,
                  "Birth Certificate (PSA)": student.intakeDocuments.birthCertificatePsa,
                  "Good Moral Character": student.intakeDocuments.goodMoralCharacter,
                  "Qualified Voucher": student.intakeDocuments.qualifiedVoucher,
                  "ESC Certificate": student.intakeDocuments.escCertificate,
                }).map(([label, status]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text)]">{label}</span>
                    {status === "received" && (
                      <div className="flex items-center gap-1.5 text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Received</span>
                      </div>
                    )}
                    {status === "not_applicable" && (
                      <span className="text-xs text-[var(--color-text-muted)]">N/A</span>
                    )}
                    {status === "to_follow" && (
                      <div className="flex items-center gap-1.5 text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">To Follow</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Balance Warning (for old students) */}
          {isOldStudent && student.hasOutstandingBalance && (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">Outstanding Balance</h4>
                  <p className="mt-1 text-sm text-amber-800">
                    This student has an outstanding balance of{" "}
                    <strong>{formatCurrency(Number(student.outstandingAmount ?? 0))}</strong> from the
                    previous school year.
                  </p>
                  <p className="mt-2 text-xs text-amber-700">
                    You may proceed with enrollment. A payment plan can be arranged with the finance office.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section Assignment (Optional) */}
          {sections.length > 0 && (
            <div className="mb-6 space-y-3">
              <label htmlFor="sectionId" className="block text-sm font-semibold text-[var(--color-text)]">
                Section Assignment <span className="text-xs font-normal text-[var(--color-text-muted)]">(Optional)</span>
              </label>
              <select
                id="sectionId"
                name="sectionId"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              >
                <option value="">Assign later</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--color-text-muted)]">
                Section can be assigned now or later from the enrollments list.
              </p>
            </div>
          )}

          {/* Information Note */}
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <strong>What happens next:</strong> This enrollment will be created with status{" "}
              <strong>Pending</strong>. The finance officer will then assess fees and create an assessment
              ledger.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isPending} disabled={isPending}>
              {isPending ? "Confirming..." : isOldStudent ? "Confirm Re-Enrollment" : "Confirm Enrollment"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
