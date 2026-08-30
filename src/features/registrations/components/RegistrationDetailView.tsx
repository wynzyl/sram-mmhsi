"use client";

import { useState } from "react";
import Link from "next/link";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { GuardianCard } from "@/features/registrations/components/GuardianCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import { StudentAvatar } from "@/features/students/components/StudentAvatar";
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
import { TabNav, type TabItem } from "@/components/shared/TabNav";
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
  Zap,
} from "lucide-react";
import type { DiscountRequestView, DiscountTypeView } from "@/features/discounts/discounts.schema";
import { PortalAccountCard } from "@/features/students/components/PortalAccountCard";
import type { PortalAccountInfo } from "@/features/portal-accounts/portal-accounts.schema";
// Tab components extracted for maintainability (audit 2026-07)
import {
  RegistrationHistoryTab,
  RegistrationDocumentsTab,
  RegistrationBillingTab,
  RegistrationInvoicesTab,
  RegistrationDiscountsTab,
} from "./tabs";

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
  /** Portal account info for this student */
  portalAccount?: PortalAccountInfo | null;
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
  portalAccount,
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

  const tabs: TabItem<typeof tab>[] = [
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

      <header className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div
          className="h-24 border-b border-border bg-muted sm:h-28 print:h-16"
          aria-hidden
        />
        <div className="relative px-4 pb-1 pt-0 sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <div className="-mt-12 sm:-mt-14">
                <StudentAvatar
                  photoUrl={student.photoUrl}
                  initials={initials}
                  size="lg"
                />
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
                <p className="text-secondary sm:text-base">
                  <span className="font-mono text-foreground">{student.referenceNumber}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  {placementSubtitle}
                </p>
                {student.lrn || age != null ? (
                  <p className="text-helper sm:text-sm">
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
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/80"
              >
                <Printer className="h-4 w-4" aria-hidden />
                Print record
              </button>
            </div>
          </div>

          <TabNav
            tabs={tabs}
            activeTab={tab}
            onTabChange={setTab}
          />
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
                  <p className="text-secondary">
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
                        <span className="block text-helper">Start or continue enrollment</span>
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
                        <span className="block text-helper">
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
                        <span className="block text-helper">Opens your mail app</span>
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
                        <span className="block text-helper">Open the invoices tab</span>
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
                      <span className="block text-helper">Checklist & requirements</span>
                    </span>
                  </button>
                </li>
              </ul>
            </DataCard>

            {student.bloodType ? (
              <DataCard className="border-warning/45 bg-warning/10 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-warning">
                  Health note
                </h3>
                <p className="text-sm text-foreground">
                  Blood type on file:{" "}
                  <span className="font-semibold">{student.bloodType}</span>. (Allergies and protocols
                  are not tracked in SRAMS yet.)
                </p>
              </DataCard>
            ) : null}

            {/* Portal Account Management */}
            {flags.canManagePortalAccounts && (
              <PortalAccountCard
                studentId={student.id}
                referenceNumber={student.referenceNumber}
                account={portalAccount ?? null}
                canManage={flags.canManagePortalAccounts}
              />
            )}
          </aside>
        </div>
      )}

      {tab === "documents" && (
        <RegistrationDocumentsTab
          requirementsSnapshots={requirementsSnapshots}
          flags={flags}
        />
      )}

      {tab === "history" && (
        <RegistrationHistoryTab
          enrollments={enrollmentRows}
          flags={flags}
        />
      )}

      {tab === "billing" && flags.canReadAssessments && (
        <RegistrationBillingTab assessmentSummaries={assessmentSummaries} />
      )}

      {tab === "invoices" && flags.canReadInvoices && (
        <RegistrationInvoicesTab invoices={invoices} />
      )}

      {tab === "discounts" && flags.canReadDiscounts && (
        <RegistrationDiscountsTab
          studentId={student.id}
          discountRequests={discountRequests}
          discountTypes={discountTypes}
          activeEnrollmentId={activeEnrollmentId}
          flags={flags}
        />
      )}

    </div>
  );
}
