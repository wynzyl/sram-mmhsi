"use client";

import { useState } from "react";
import Link from "next/link";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { DocumentProgressRing } from "@/features/registrations/components/DocumentProgressRing";
import { GuardianCard } from "@/features/registrations/components/GuardianCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import type {
  StudentRecordStudent,
  GuardianRow,
  EnrollmentRecordRow,
  AssessmentSummaryRow,
  InvoiceSummaryRow,
  CurrentPlacement,
  StudentRecordFlags,
} from "@/features/students/components/StudentRecordProfile";
import type { StudentRequirementsSnapshot } from "@/features/registrations/registrations.queries";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import {
  enrollmentIntakeDocumentsToPreserved,
  intakeFieldStatusDisplay,
  isIntakeDocumentsComplete,
  registrationStudentTypeLabel,
} from "@/lib/utils/intake-documents";
import EditIntakeDocumentsDialog from "@/features/enrollments/components/EditIntakeDocumentsDialog";
import EnrollmentCancelAction from "@/features/registrations/components/EnrollmentCancelAction";
import { cn } from "@/lib/utils/cn";
import { formatPhoneNumber } from "@/lib/utils/phone";
import { formatDate } from "@/lib/utils/date";
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Printer,
  Tag,
  Zap,
} from "lucide-react";
import type { DiscountRequestView, DiscountTypeView } from "@/features/discounts/discounts.schema";
import DiscountRequestForm from "@/features/discounts/components/DiscountRequestForm";

function enrollmentTypeLabel(studentType: string): string {
  if (studentType === "new_student") return "New";
  if (studentType === "transferee") return "Transferee";
  if (studentType === "old_student") return "Old";
  return studentType.replace(/_/g, " ");
}

function primaryAssessmentId(
  enrollmentRows: EnrollmentRecordRow[],
  assessmentSummaries: AssessmentSummaryRow[]
): string | null {
  const active = enrollmentRows.find(
    (r) => r.status === "enrolled" && r.schoolYearIsActive && r.assessmentId
  );
  if (active?.assessmentId) return active.assessmentId;
  return assessmentSummaries[0]?.id ?? null;
}

function primaryGuardianMailto(guardians: GuardianRow[]): string | null {
  const primary = guardians.find((g) => g.isPrimary);
  const g = primary ?? guardians[0];
  const email = g?.email?.trim();
  if (!email) return null;
  const subject = encodeURIComponent("SRAMS — Student inquiry");
  return `mailto:${email}?subject=${subject}`;
}

function computeAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age;
}

function invoiceStatusVariant(
  status: string
): "secondary" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "settled":
      return "success";
    case "sent":
      return "info";
    case "viewed":
      return "secondary";
    case "overdue":
      return "danger";
    default:
      return "warning";
  }
}

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

function EnrollmentBillingCell({
  row,
  flags,
}: {
  row: EnrollmentRecordRow;
  flags: StudentRecordFlags;
}) {
  if (row.status === "cancelled") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (flags.canReadAssessments && row.assessmentId) {
    return (
      <Link
        href={`/staff/assessments/${row.assessmentId}`}
        className="font-mono text-sm text-primary underline-offset-2 hover:underline"
      >
        Open ledger
      </Link>
    );
  }

  if (row.status === "pending" && flags.canCreateAssessment) {
    return (
      <Link
        href={`/staff/assessments/new/${row.id}`}
        className="font-mono text-sm text-primary underline-offset-2 hover:underline"
      >
        Build assessment
      </Link>
    );
  }

  if (row.status === "assessed" && !row.assessmentId && flags.canReadAssessments) {
    return <span className="text-sm text-muted-foreground">Missing ledger</span>;
  }

  return <span className="text-muted-foreground">—</span>;
}

export type RegistrationDetailViewProps = {
  student: StudentRecordStudent;
  guardians: GuardianRow[];
  enrollments: EnrollmentRecordRow[];
  requirementsSnapshots: StudentRequirementsSnapshot[];
  placement: CurrentPlacement;
  assessmentSummaries: AssessmentSummaryRow[];
  invoices: InvoiceSummaryRow[];
  /** Discount requests for this student */
  discountRequests?: DiscountRequestView[];
  /** Available discount types for requesting */
  discountTypes?: DiscountTypeView[];
  /** Active enrollment ID for new discount requests */
  activeEnrollmentId?: string;
  flags: StudentRecordFlags;
  backHref: string;
  backLabel?: string;
};

/**
 * Editorial, registration-focused student detail: overview, document progress, history,
 * and the same billing/invoice access as the classic record when permissions allow.
 */
export function RegistrationDetailView({
  student,
  guardians,
  enrollments: enrollmentRows,
  requirementsSnapshots,
  placement,
  assessmentSummaries,
  invoices,
  discountRequests = [],
  discountTypes = [],
  activeEnrollmentId,
  flags,
  backHref,
  backLabel = "Back to queue",
}: RegistrationDetailViewProps) {
  const [tab, setTab] = useState<
    "overview" | "documents" | "history" | "billing" | "invoices" | "discounts"
  >("overview");

  const fullName = [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");

  const age = student.dateOfBirth ? computeAge(new Date(student.dateOfBirth)) : null;

  const initials = [student.firstName?.[0], student.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  const latestAssessment = assessmentSummaries[0];
  const assessmentIdForActions = primaryAssessmentId(enrollmentRows, assessmentSummaries);
  const guardianMail = primaryGuardianMailto(guardians);

  const placementSubtitle = placement
    ? `${placement.gradeLevel}${placement.sectionName ? ` · ${placement.sectionName}` : ""} · ${placement.schoolYear}`
    : "No active school-year enrollment";

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "history", label: "Enrollment History" },
  ];
  if (flags.canReadAssessments) tabs.push({ id: "billing", label: "Billing" });
  if (flags.canReadInvoices) tabs.push({ id: "invoices", label: "Invoices" });
  if (flags.canReadDiscounts) tabs.push({ id: "discounts", label: "Discounts" });

  return (
    <div className="page-container space-y-8 print:space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        ← {backLabel}
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-md print:shadow-none">
        <div
          className="h-28 bg-gradient-to-br from-primary via-primary/80 to-muted sm:h-32 print:h-16 print:bg-gray-200"
          aria-hidden
        />
        <div className="relative px-4 pb-1 pt-0 sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <div
                className="-mt-12 flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-muted font-display text-3xl font-bold tracking-tight text-foreground shadow-md sm:-mt-14 sm:h-32 sm:w-32 print:border-border"
                aria-hidden
              >
                {initials || "—"}
              </div>
              <div className="min-w-0 space-y-2 pb-1 sm:pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                    {fullName}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                      !student.isActive &&
                        "border-border bg-muted text-muted-foreground"
                    )}
                    style={
                      student.isActive
                        ? {
                            backgroundColor:
                              "color-mix(in srgb, hsl(var(--emerald-500)) 10%, hsl(var(--card)))",
                            borderColor:
                              "color-mix(in srgb, hsl(var(--emerald-500)) 30%, hsl(var(--border)))",
                            color: "hsl(142.1 76.2% 36.3%)",
                          }
                        : undefined
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {student.isActive ? "Active" : "Inactive"}
                  </span>
                  {placement ? (
                    <StatusIndicator status="approved" label="Enrolled (active year)" size="sm" />
                  ) : (
                    <StatusIndicator status="pending" label="Placement pending" size="sm" pulse />
                  )}
                </div>
                <p className="text-sm text-muted-foreground sm:text-base">
                  <span className="font-mono text-foreground">{student.referenceNumber}</span>
                  <span className="mx-2 text-gray-300 dark:text-gray-700">·</span>
                  {placementSubtitle}
                </p>
                {student.lrn || age != null ? (
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    {student.lrn ? (
                      <>
                        LRN <span className="font-mono text-foreground">{student.lrn}</span>
                      </>
                    ) : null}
                    {student.lrn && age != null ? <span> · </span> : null}
                    {age != null ? <>Age {age}</> : null}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1 md:pb-3 print:hidden">
              {flags.canEditStudent ? (
                <Link
                  href={`/staff/students/${student.id}/edit`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit profile
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/80"
              >
                <Printer className="h-4 w-4" aria-hidden />
                Print record
              </button>
            </div>
          </div>

          <nav
            className="mt-4 flex flex-wrap gap-1 border-t border-border pt-3 print:hidden"
            aria-label="Student record sections"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr,minmax(260px,320px)] lg:items-start">
          <div className="space-y-6">
            {flags.canReadAssessments ? (
              <DataCard className="p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
                    <FileText className="h-5 w-5 text-primary" aria-hidden />
                    Billing overview
                  </h2>
                  {latestAssessment ? (
                    <span className="text-xs font-mono text-muted-foreground">{latestAssessment.schoolYear}</span>
                  ) : null}
                </div>
                {latestAssessment ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-muted px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Assessed
                      </p>
                      <p className="mt-1 font-display text-lg font-bold text-foreground">
                        <CurrencyDisplay amount={Number(latestAssessment.totalAmount)} />
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Paid
                      </p>
                      <p className="mt-1 font-display text-lg font-bold text-foreground">
                        <CurrencyDisplay amount={Number(latestAssessment.totalPaid)} />
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Balance
                      </p>
                      <p className="mt-1 font-display text-lg font-bold text-foreground">
                        <CurrencyDisplay amount={Number(latestAssessment.balance)} />
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No assessment ledger yet. Create an assessment from an enrollment when ready.
                  </p>
                )}
              </DataCard>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <DataCard className="p-6">
                <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-foreground">
                  <Home className="h-5 w-5 text-primary" aria-hidden />
                  Contact
                </h2>
                <ul className="space-y-4 text-sm">
                  <li className="flex gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-foreground">{student.address?.trim() || "—"}</span>
                  </li>
                  <li className="flex gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="font-mono text-foreground">{student.mobileNumber?.trim() ? formatPhoneNumber(student.mobileNumber) : "—"}</span>
                  </li>
                  <li className="flex gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    {student.email?.trim() ? (
                      <a
                        href={`mailto:${student.email}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {student.email}
                      </a>
                    ) : (
                      <span className="text-foreground">—</span>
                    )}
                  </li>
                </ul>
              </DataCard>

              <DataCard className="p-6">
                <h2 className="mb-4 font-display text-xl font-bold text-foreground">Student details</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Date of birth</dt>
                    <dd className="text-right font-medium text-foreground">
                      {student.dateOfBirth
                        ? formatDate(student.dateOfBirth, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Gender</dt>
                    <dd className="text-right capitalize text-foreground">{student.gender ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Previous school</dt>
                    <dd className="max-w-[55%] text-right text-foreground">
                      {student.previousSchool ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Document notes</dt>
                    <dd className="max-w-[55%] whitespace-pre-wrap text-right text-foreground">
                      {student.submittedDocumentsNotes ?? "—"}
                    </dd>
                  </div>
                </dl>
              </DataCard>
            </div>

            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground">Parents / guardians</h2>
              {guardians.length === 0 ? (
                <DataCard className="p-6">
                  <p className="text-muted-foreground">No guardians on file.</p>
                </DataCard>
              ) : (
                guardians.map((g) => (
                  <GuardianCard
                    key={g.id}
                    compact
                    guardian={{
                      id: g.id,
                      firstName: g.firstName,
                      middleName: g.middleName,
                      lastName: g.lastName,
                      relationship: g.relationship,
                      contactNumber: g.contactNumber ?? "",
                      email: g.email ?? "",
                      address: g.address,
                      isPrimary: g.isPrimary,
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="space-y-6 print:hidden">
            <DataCard className="p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <Zap className="h-5 w-5 text-primary" aria-hidden />
                Quick actions
              </h2>
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {flags.canEnroll ? (
                  <li className="h-full">
                    <Link
                      href={`/staff/enrollments/new?studentId=${student.id}`}
                      className="flex h-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <CalendarDays className="h-5 w-5 text-foreground" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">Enrollment</span>
                        <span className="block text-xs text-muted-foreground">Start or continue enrollment</span>
                      </span>
                    </Link>
                  </li>
                ) : null}
                {flags.canReadAssessments && assessmentIdForActions ? (
                  <li className="h-full">
                    <Link
                      href={`/staff/assessments/${assessmentIdForActions}`}
                      className="flex h-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        {flags.canPostPayments ? (
                          <CreditCard className="h-5 w-5 text-foreground" aria-hidden />
                        ) : (
                          <FileText className="h-5 w-5 text-foreground" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">
                          {flags.canPostPayments ? "Billing & payments" : "Assessment ledger"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {flags.canPostPayments
                            ? "Ledger, allocations, and OR posting"
                            : "Fees, lines, and history"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ) : null}
                {guardianMail ? (
                  <li className="h-full">
                    <a
                      href={guardianMail}
                      className="flex h-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Mail className="h-5 w-5 text-foreground" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">Email guardian</span>
                        <span className="block text-xs text-muted-foreground">Opens your mail app</span>
                      </span>
                    </a>
                  </li>
                ) : null}
                {flags.canReadInvoices ? (
                  <li className="h-full">
                    <button
                      type="button"
                      onClick={() => setTab("invoices")}
                      className="flex h-full w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-foreground" aria-hidden />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block text-sm font-semibold text-foreground">Invoices</span>
                        <span className="block text-xs text-muted-foreground">Open the invoices tab</span>
                      </span>
                    </button>
                  </li>
                ) : null}
                <li className="h-full">
                  <button
                    type="button"
                    onClick={() => setTab("documents")}
                    className="flex h-full w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <ClipboardList className="h-5 w-5 text-foreground" aria-hidden />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-sm font-semibold text-foreground">Intake documents</span>
                      <span className="block text-xs text-muted-foreground">Checklist & requirements</span>
                    </span>
                  </button>
                </li>
              </ul>
            </DataCard>

            {student.bloodType ? (
              <DataCard className="border-amber-400/45 bg-amber-500/10 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-300">
                  Health note
                </h3>
                <p className="text-sm text-foreground">
                  Blood type on file:{" "}
                  <span className="font-semibold">{student.bloodType}</span>. (Allergies and protocols
                  are not tracked in SRAMS yet.)
                </p>
              </DataCard>
            ) : null}
          </aside>
        </div>
      )}

      {tab === "documents" && (
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
                    <p className="mt-4 text-sm font-medium text-emerald-500">Checklist complete</p>
                  ) : null}
                </DataCard>
              );
            })
          )}
        </div>
      )}

      {tab === "history" && (
        <DataCard className="overflow-hidden">
          {enrollmentRows.length === 0 ? (
            <p className="p-6 text-muted-foreground">No enrollment records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">School year</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Billing</th>
                    <th className="px-4 py-3">Enrolled</th>
                    <th className="px-4 py-3">Created</th>
                    {flags.canCancelEnrollment && <th className="px-4 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {enrollmentRows.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                      <td className="px-4 py-3">
                        <Link
                          href={`/staff/enrollments/${row.id}`}
                          className="text-primary hover:underline underline-offset-2"
                        >
                          {row.schoolYear}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{row.gradeLevel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.sectionName ?? "—"}</td>
                      <td className="px-4 py-3">{enrollmentTypeLabel(row.studentType)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} type="enrollment" />
                      </td>
                      <td className="px-4 py-3">
                        <EnrollmentBillingCell row={row} flags={flags} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.enrolledAt
                          ? formatDate(row.enrolledAt, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(row.createdAt, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      {flags.canCancelEnrollment && (
                        <td className="px-4 py-3">
                          <EnrollmentCancelAction
                            enrollmentId={row.id}
                            enrollmentStatus={row.status}
                            schoolYearIsActive={row.schoolYearIsActive}
                            hasPendingCancellation={row.hasPendingCancellation}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      )}

      {tab === "billing" && flags.canReadAssessments && (
        <DataCard className="overflow-hidden">
          {assessmentSummaries.length === 0 ? (
            <p className="p-6 text-muted-foreground">No assessment ledgers for this student.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">School year</th>
                    <th className="px-4 py-3">Assessed</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {assessmentSummaries.map((a) => (
                    <tr key={a.id} className="border-b border-border">
                      <td className="px-4 py-3">{a.schoolYear}</td>
                      <td className="px-4 py-3">
                        <CurrencyDisplay amount={Number(a.totalAmount)} />
                      </td>
                      <td className="px-4 py-3">
                        <CurrencyDisplay amount={Number(a.totalPaid)} />
                      </td>
                      <td className="px-4 py-3">
                        <CurrencyDisplay amount={Number(a.balance)} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="billing" status={a.billingStatus} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/staff/assessments/${a.id}`}
                          className="font-mono text-sm text-primary underline-offset-2 hover:underline"
                        >
                          Ledger
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      )}

      {tab === "invoices" && flags.canReadInvoices && (
        <DataCard className="overflow-hidden">
          {invoices.length === 0 ? (
            <p className="p-6 text-muted-foreground">No invoices for this student.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        <CurrencyDisplay amount={Number(inv.amountDue)} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={invoiceStatusVariant(inv.status)} className="text-xs capitalize">
                          {inv.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {inv.dueDate
                          ? formatDate(inv.dueDate, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(inv.createdAt, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/staff/finance/invoices/${inv.id}`}
                          className="font-mono text-sm text-primary underline-offset-2 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      )}

      {tab === "discounts" && flags.canReadDiscounts && (
        <div className="space-y-6">
          {/* Status summary banner — surfaces counts by status so the reviewer
              can see at a glance whether the student has any reversed,
              pending, or rejected discount activity without scanning the
              table. */}
          {discountRequests.length > 0 && (() => {
            const counts = discountRequests.reduce(
              (acc, r) => {
                acc[r.status] = (acc[r.status] ?? 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            );
            const reversedCount = counts.reversed ?? 0;
            return (
              <DataCard
                className={
                  reversedCount > 0
                    ? "p-4 border-destructive/40 bg-destructive/5"
                    : "p-4"
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    Discount status:
                  </span>
                  {counts.pending ? (
                    <Badge variant="warning" className="text-xs">
                      {counts.pending} Pending
                    </Badge>
                  ) : null}
                  {counts.approved ? (
                    <Badge variant="success" className="text-xs">
                      {counts.approved} Approved
                    </Badge>
                  ) : null}
                  {counts.rejected ? (
                    <Badge variant="danger" className="text-xs">
                      {counts.rejected} Rejected
                    </Badge>
                  ) : null}
                  {counts.cancelled ? (
                    <Badge variant="secondary" className="text-xs">
                      {counts.cancelled} Cancelled
                    </Badge>
                  ) : null}
                  {reversedCount ? (
                    <Badge variant="danger" className="text-xs">
                      {reversedCount} Reversed
                    </Badge>
                  ) : null}
                </div>
                {reversedCount > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    This student has reversed discount(s). New discount
                    requests are locked on any assessment where payment
                    activity has been recorded.
                  </p>
                )}
              </DataCard>
            );
          })()}

          {/* Request New Discount Form */}
          {flags.canRequestDiscounts && activeEnrollmentId && discountTypes.length > 0 && (
            <DataCard className="p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground mb-4">
                <Tag className="h-5 w-5 text-primary" aria-hidden />
                Request Discount
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Submit a discount request for approval by finance.
              </p>
              <DiscountRequestForm
                studentId={student.id}
                enrollmentId={activeEnrollmentId}
                discountTypes={discountTypes}
              />
            </DataCard>
          )}

          {/* No eligible enrollment warning */}
          {flags.canRequestDiscounts && !activeEnrollmentId && (
            <DataCard className="p-6 border-amber-500/30 bg-amber-500/5">
              <p className="text-sm text-amber-600">
                Discount requests are only allowed for pending enrollments before an assessment is created.
                Once enrolled or assessed, discounts cannot be requested.
              </p>
            </DataCard>
          )}

          {/* Discount Requests List */}
          <DataCard className="overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="font-display text-xl font-bold text-foreground">
                Discount Requests
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                History of discount requests for this student
              </p>
            </div>
            {discountRequests.length === 0 ? (
              <p className="p-6 text-muted-foreground">No discount requests for this student.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">School Year</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Requested</th>
                      <th className="px-4 py-3">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountRequests.map((req) => (
                      <tr key={req.id} className="border-b border-border">
                        <td className="px-4 py-3">{req.schoolYearLabel}</td>
                        <td className="px-4 py-3">{req.gradeLevelName}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{req.discountTypeName}</div>
                          <div className="text-xs text-muted-foreground">{req.discountTypeCode}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">
                            {req.calculationType === "percentage"
                              ? `${Number(req.overrideValue ?? req.defaultValue)}%`
                              : <CurrencyDisplay amount={Number(req.overrideValue ?? req.defaultValue)} className="inline" />}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {req.baseType === "tuition_only" ? "Tuition" : "Full"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {req.status === "pending" && (
                            <Badge variant="warning" className="text-xs">Pending</Badge>
                          )}
                          {req.status === "approved" && (
                            <Badge variant="success" className="text-xs">Approved</Badge>
                          )}
                          {req.status === "rejected" && (
                            <Badge variant="danger" className="text-xs">Rejected</Badge>
                          )}
                          {req.status === "cancelled" && (
                            <Badge variant="secondary" className="text-xs">Cancelled</Badge>
                          )}
                          {req.status === "reversed" && (
                            <Badge variant="danger" className="text-xs">Reversed</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div>
                            {formatDate(req.requestedAt, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          <div className="text-xs">by {req.requestedByName}</div>
                          {req.requestReason && (
                            <div className="text-xs italic mt-1 max-w-[150px] truncate" title={req.requestReason}>
                              {req.requestReason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {req.decidedAt ? (
                            <>
                              <div>
                                {formatDate(req.decidedAt, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </div>
                              {req.decidedByName && <div className="text-xs">by {req.decidedByName}</div>}
                              {req.decisionRemarks && (
                                <div className="text-xs italic mt-1 max-w-[150px] truncate" title={req.decisionRemarks}>
                                  {req.decisionRemarks}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </div>
      )}

    </div>
  );
}
