"use client";

import { useActionState, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, CheckCircle2, AlertCircle, FileText, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFormToast } from "@/hooks/useFormToast";
import {
  confirmEnrollmentAction,
  fetchReadyToEnrollDetailAction,
} from "../enrollment-confirmation.actions";
import { formatCurrency } from "@/lib/utils/currency";
import { queryKeys } from "@/lib/query/keys";
import type { ConfirmEnrollmentFormState } from "../enrollments.schema";
import type { ReadyToEnrollListRow } from "../enrollments-queue.queries";

type EnrollmentConfirmationDrawerProps = {
  student: ReadyToEnrollListRow;
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

  useFormToast(state, {
    successMessage: "Enrollment confirmed successfully",
    onSuccess: () => {
      if (state.enrollmentId) {
        onSuccess?.(state.enrollmentId);
      }
      onClose();
    },
  });

  // Only fetch detail for new/transferee students who have intakeDocuments
  const needsDetail =
    student.studentType === "new_student" || student.studentType === "transferee";

  const {
    data: studentDetail,
    error: detailQueryError,
    isLoading: isLoadingDetail,
  } = useQuery({
    queryKey: queryKeys.enrollments.detail(student.studentId),
    queryFn: async () => {
      const result = await fetchReadyToEnrollDetailAction(student.studentId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: isOpen && needsDetail && Boolean(student.studentId),
  });

  const detailError = detailQueryError ? detailQueryError.message : null;

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

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-card shadow-2xl flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-border bg-card px-6 py-4 rounded-t-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {isOldStudent ? "Re-Enrollment Confirmation" : "Enrollment Confirmation"}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
                  {student.lastName}, {student.firstName}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{student.studentRef}</p>
              </div>
              <button
                onClick={onClose}
                disabled={isPending}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-foreground"
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
            <div className="mb-6 space-y-4 rounded-lg border border-border bg-muted p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                <GraduationCap className="h-4 w-4" />
                Enrollment Details
              </h3>

              <div className="grid gap-3">
                {isOldStudent && (
                  <div className="flex items-start justify-between border-b border-border pb-2">
                    <span className="text-sm text-muted-foreground">Previous Grade</span>
                    <span className="text-sm font-medium text-foreground">
                      {student.previousGradeName}
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground">
                    {isOldStudent ? "Promoting to" : "Enrolling Grade"}
                  </span>
                  <span className="text-sm font-semibold text-primary">{gradeLevelName}</span>
                </div>

                {student.studentType === "transferee" && student.registrationId && (
                  <div className="flex items-start justify-between border-b border-border pb-2">
                    <span className="text-sm text-muted-foreground">Registration ID</span>
                    <span className="font-mono text-xs text-foreground">
                      {student.registrationId.slice(0, 8)}...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Document Status (for new/transferee) - Lazy loaded */}
            {isNewOrTransferee && (
              <div className="mb-6 space-y-4 rounded-lg border border-border bg-muted p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  <FileText className="h-4 w-4" />
                  Document Checklist
                </h3>

                {isLoadingDetail ? (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-sm">Loading documents...</span>
                  </div>
                ) : detailError ? (
                  <div className="text-sm text-amber-600">{detailError}</div>
                ) : studentDetail?.intakeDocuments ? (
                  <div className="space-y-2">
                    {Object.entries({
                      "Form 138": studentDetail.intakeDocuments.form138,
                      "Birth Certificate (PSA)": studentDetail.intakeDocuments.birthCertificatePsa,
                      "Good Moral Character": studentDetail.intakeDocuments.goodMoralCharacter,
                      "Qualified Voucher": studentDetail.intakeDocuments.qualifiedVoucher,
                      "ESC Certificate": studentDetail.intakeDocuments.escCertificate,
                    }).map(([label, status]) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{label}</span>
                        {status === "received" && (
                          <div className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Received</span>
                          </div>
                        )}
                        {status === "not_applicable" && (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                        {status === "to_follow" && (
                          <div className="flex items-center gap-1.5 text-amber-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">To Follow</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No documents available</div>
                )}
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
                <label htmlFor="sectionId" className="block text-sm font-semibold text-foreground">
                  Section Assignment <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                </label>
                <select
                  id="sectionId"
                  name="sectionId"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Assign later</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
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
            <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isPending} disabled={isPending}>
                {isPending ? "Confirming..." : isOldStudent ? "Confirm Re-Enrollment" : "Confirm Enrollment"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
