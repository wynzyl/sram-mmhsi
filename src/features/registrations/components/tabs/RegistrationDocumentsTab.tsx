"use client";

import { DataCard } from "@/components/ui/editorial/DataCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { DocumentProgressRing } from "@/features/registrations/components/DocumentProgressRing";
import { formatDate } from "@/lib/utils/date";
import type { StudentRequirementsSnapshot } from "@/features/registrations/registrations.queries";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import type { StudentRecordFlags } from "@/features/students/components/StudentRecordProfile";
import {
  enrollmentIntakeDocumentsToPreserved,
  intakeFieldStatusDisplay,
  isIntakeDocumentsComplete,
  registrationStudentTypeLabel,
} from "@/lib/utils/intake-documents";
import EditIntakeDocumentsDialog from "@/features/enrollments/components/EditIntakeDocumentsDialog";

const INTAKE_ROWS: { key: keyof EnrollmentIntakeDocuments; label: string }[] = [
  { key: "form138", label: "FORM 138" },
  { key: "birthCertificatePsa", label: "Birth Certificate (PSA)" },
  { key: "goodMoralCharacter", label: "Good Moral Character" },
  { key: "qualifiedVoucher", label: "Qualified Voucher Certificate (if any)" },
  { key: "escCertificate", label: "ESC Certificate (if any)" },
];

function countIntakeComplete(docs: EnrollmentIntakeDocuments | null): { done: number; total: number } {
  if (!docs) return { done: 0, total: 5 };
  const fields = [
    docs.form138,
    docs.birthCertificatePsa,
    docs.goodMoralCharacter,
    docs.qualifiedVoucher,
    docs.escCertificate,
  ];
  const done = fields.filter((f) => f === "received" || f === "not_applicable").length;
  return { done, total: 5 };
}

export type RegistrationDocumentsTabProps = {
  requirementsSnapshots: StudentRequirementsSnapshot[];
  flags: StudentRecordFlags;
};

/**
 * Documents/intake checklist tab for RegistrationDetailView.
 * Extracted for maintainability (audit 2026-07).
 */
export function RegistrationDocumentsTab({
  requirementsSnapshots,
  flags,
}: RegistrationDocumentsTabProps) {
  return (
    <div className="space-y-6">
      {requirementsSnapshots.length === 0 ? (
        <DataCard className="p-8 text-center">
          <p className="text-muted-foreground">No enrollment intake checklists on file for this student.</p>
        </DataCard>
      ) : (
        requirementsSnapshots.map((snap) => {
          const progress = countIntakeComplete(snap.intakeDocuments);
          const complete =
            snap.intakeDocuments != null && isIntakeDocumentsComplete(snap.intakeDocuments);
          const canEditIntake =
            flags.canUpdateEnrollment &&
            snap.enrollmentStatus !== "cancelled" &&
            (snap.studentType === "new_student" || snap.studentType === "transferee") &&
            snap.intakeDocuments != null;
          return (
            <DataCard key={snap.enrollmentId} className="p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {snap.schoolYear} · {snap.gradeLevel}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Type {registrationStudentTypeLabel(snap.studentType)} · Recorded{" "}
                    {formatDate(snap.recordedAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={snap.enrollmentStatus} type="enrollment" />
                    {canEditIntake && (
                      <EditIntakeDocumentsDialog
                        enrollmentId={snap.enrollmentId}
                        schoolYear={snap.schoolYear}
                        gradeLevel={snap.gradeLevel}
                        preserved={enrollmentIntakeDocumentsToPreserved(snap.intakeDocuments!)}
                      />
                    )}
                  </div>
                </div>
                <DocumentProgressRing completed={progress.done} total={progress.total} size="lg" />
              </div>
              {!snap.intakeDocuments ? (
                <p className="mt-4 text-sm text-muted-foreground">No checklist data for this enrollment.</p>
              ) : (
                <ul className="mt-6 space-y-2">
                  {INTAKE_ROWS.map(({ key, label }) => {
                    const raw = snap.intakeDocuments![key];
                    const { label: statusLabel, variant } = intakeFieldStatusDisplay(raw);
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted px-4 py-3"
                      >
                        <span className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
                          {label}
                        </span>
                        <Badge variant={variant} className="shrink-0 text-xs capitalize">
                          {statusLabel}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
              {complete ? (
                <p className="mt-4 text-sm font-medium text-success">Checklist complete</p>
              ) : null}
            </DataCard>
          );
        })
      )}
    </div>
  );
}
