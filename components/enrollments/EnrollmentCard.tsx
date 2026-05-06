"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { updateEnrollmentStatusAction } from "@/actions/enrollments";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import { DocumentProgressRing } from "@/components/registrations/DocumentProgressRing";
import { PaymentProgressBar } from "@/components/enrollments/PaymentProgressBar";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import { cn } from "@/lib/utils/cn";

export type EnrollmentStatus = "pending" | "assessed" | "enrolled" | "cancelled";

export interface EnrollmentCardRow {
  id: string;
  status: EnrollmentStatus;
  studentName: string;
  referenceNumber: string;
  studentId: string;
  schoolYear: string;
  gradeLevel: string;
  section: string | null;
  studentType: "new_student" | "transferee" | "old_student";
  enrolledAt: Date | null;
  createdAt: Date;
  assessmentId: string | null;
  assessmentTotalAmount: number | null;
  assessmentTotalPaid: number | null;
  intakeDocuments: EnrollmentIntakeDocuments | null;
}

export interface SectionOption {
  id: string;
  name: string;
}

interface EnrollmentCardProps {
  enrollment: EnrollmentCardRow;
  sections: SectionOption[];
  canManage: boolean;
  canCancel: boolean;
  canCancelWithBalance: boolean;
  canOverrideEnrolled: boolean;
  portalBase: "/admin" | "/staff";
  className?: string;
}

const TYPE_LABEL: Record<EnrollmentCardRow["studentType"], string> = {
  new_student: "New",
  transferee: "Transferee",
  old_student: "Returning",
};

const STATUS_TO_INDICATOR: Record<
  EnrollmentStatus,
  { status: "pending" | "to-follow" | "complete" | "declined"; pulse?: boolean }
> = {
  pending: { status: "pending", pulse: true },
  assessed: { status: "to-follow" },
  enrolled: { status: "complete" },
  cancelled: { status: "declined" },
};

const OUTSTANDING_PAYMENT_EPSILON = 0.009;

function formatPhp(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function withPortal(href: string, portalBase: "/admin" | "/staff"): string {
  return portalBase === "/staff" ? href.replace(/^\/admin/, "/staff") : href;
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function countIntakeDocuments(docs: EnrollmentIntakeDocuments | null): {
  completed: number;
  total: number;
} {
  if (!docs) return { completed: 0, total: 5 };
  const fields = [
    docs.form138,
    docs.birthCertificatePsa,
    docs.goodMoralCharacter,
    docs.qualifiedVoucher,
    docs.escCertificate,
  ];
  const completed = fields.filter(
    (v) => v === "received" || v === "not_applicable"
  ).length;
  return { completed, total: 5 };
}

/**
 * Editorial card representing one enrollment row in the queue.
 * Replaces a row of the legacy `EnrollmentsTable`.
 */
export function EnrollmentCard({
  enrollment: en,
  sections,
  canManage,
  canCancel,
  canCancelWithBalance,
  canOverrideEnrolled,
  portalBase,
  className,
}: EnrollmentCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false);

  const indicator = STATUS_TO_INDICATOR[en.status];
  const showActions = canManage || canCancel || canOverrideEnrolled;
  const isFinanceStatus = en.status === "assessed" || en.status === "enrolled";

  return (
    <DataCard
      hoverable
      className={cn(
        "relative overflow-hidden",
        en.status === "cancelled" && "opacity-75",
        className
      )}
    >
      {/* Status colour rail on the left edge */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-0 h-full w-1",
          en.status === "pending" && "bg-[var(--color-accent-amber)]",
          en.status === "assessed" && "bg-[var(--color-accent-slate)]",
          en.status === "enrolled" && "bg-[var(--color-accent-emerald)]",
          en.status === "cancelled" && "bg-gray-300"
        )}
      />

      <div className="px-6 py-5 pl-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: identity + meta */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h3 className="font-display text-xl font-bold uppercase leading-tight tracking-tight text-ops-ink">
                {en.studentName}
              </h3>
              <StatusIndicator
                status={indicator.status}
                pulse={indicator.pulse}
                size="sm"
                label={en.status.charAt(0).toUpperCase() + en.status.slice(1)}
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <code className="rounded bg-(--color-surface-3) px-2 py-0.5 font-mono text-[12px] text-(--color-text)">
                {en.referenceNumber}
              </code>
              <span className="text-ops-muted">·</span>
              <span className="font-medium text-ops-ink">{en.gradeLevel}</span>
              {en.section && (
                <>
                  <span className="text-ops-muted">·</span>
                  <span className="text-ops-muted">Section {en.section}</span>
                </>
              )}
              <span className="text-ops-muted">·</span>
              <span className="text-ops-muted">{en.schoolYear}</span>
              <span className="text-ops-muted">·</span>
              <span className="rounded-full bg-[var(--color-primary)]/8 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                {TYPE_LABEL[en.studentType]}
              </span>
            </div>

            <p className="text-xs text-ops-muted">
              {en.status === "enrolled" && en.enrolledAt
                ? `Enrolled ${formatDate(en.enrolledAt)}`
                : `Created ${formatDate(en.createdAt)}`}
            </p>
          </div>

          {/* Middle: progress visualisation (intake ring or payment bar) */}
          <div className="flex shrink-0 items-center justify-start gap-4 lg:w-72 lg:justify-center">
            {isFinanceStatus ? (
              <FinanceProgress
                paid={en.assessmentTotalPaid ?? 0}
                total={en.assessmentTotalAmount ?? 0}
              />
            ) : en.status === "pending" ? (
              <IntakeRingBlock intakeDocuments={en.intakeDocuments} />
            ) : (
              <CancelledBlock />
            )}
          </div>

          {/* Right: primary CTA stack */}
          <div className="flex shrink-0 flex-col items-stretch gap-2 lg:w-44">
            <PrimaryAction enrollment={en} portalBase={portalBase} canManage={canManage} />
            <Link
              href={withPortal(`/admin/students/${en.studentId}`, portalBase)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-ops-ink transition-colors hover:bg-light-gray"
            >
              <User className="h-3.5 w-3.5" />
              Student profile
            </Link>
            {showActions && en.status !== "cancelled" && (
              <button
                type="button"
                onClick={() => setActionsOpen((o) => !o)}
                className="inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-medium text-ops-muted transition-colors hover:bg-light-gray hover:text-ops-ink"
                aria-expanded={actionsOpen}
              >
                {actionsOpen ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Hide actions
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    More actions
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Disclosed action surface: cancel + admin override */}
        {actionsOpen && en.status !== "cancelled" && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 md:grid-cols-2">
            {en.status === "assessed" && canOverrideEnrolled && (
              <OverrideEnrollBlock enrollmentId={en.id} sections={sections} />
            )}
            {canCancel && (
              <CancelInline
                enrollmentId={en.id}
                status={en.status}
                assessmentId={en.assessmentId}
                assessmentTotalPaid={en.assessmentTotalPaid}
                canCancelWithBalance={canCancelWithBalance}
                portalBase={portalBase}
              />
            )}
          </div>
        )}
      </div>
    </DataCard>
  );
}

// ──────────────────────── Primary action ────────────────────────

function PrimaryAction({
  enrollment: en,
  portalBase,
  canManage,
}: {
  enrollment: EnrollmentCardRow;
  portalBase: "/admin" | "/staff";
  canManage: boolean;
}) {
  if (en.status === "pending" && canManage) {
    return (
      <Link
        href={withPortal(`/admin/assessments/new/${en.id}`, portalBase)}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md"
      >
        Build assessment
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  if (en.status === "assessed" && en.assessmentId) {
    return (
      <Link
        href={withPortal(`/admin/assessments/${en.assessmentId}`, portalBase)}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md"
      >
        <Receipt className="h-3.5 w-3.5" />
        Open ledger
      </Link>
    );
  }

  if (en.status === "enrolled" && en.assessmentId) {
    return (
      <Link
        href={withPortal(`/admin/assessments/${en.assessmentId}`, portalBase)}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md"
      >
        <Receipt className="h-3.5 w-3.5" />
        View ledger
      </Link>
    );
  }

  if (en.status === "cancelled" && canManage) {
    return (
      <Link
        href={`${withPortal("/admin/enrollments/new", portalBase)}?studentId=${en.studentId}`}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-ops-ink transition-colors hover:bg-light-gray"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Re-enroll
      </Link>
    );
  }

  return null;
}

// ──────────────────────── Progress blocks ────────────────────────

function IntakeRingBlock({
  intakeDocuments,
}: {
  intakeDocuments: EnrollmentIntakeDocuments | null;
}) {
  const { completed, total } = countIntakeDocuments(intakeDocuments);
  return (
    <div className="flex items-center gap-3">
      <DocumentProgressRing completed={completed} total={total} size="sm" showLabel={false} />
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ops-muted">
          Intake
        </p>
        <p className="mt-0.5 text-sm font-medium text-ops-ink">
          {completed === total
            ? "All documents in"
            : completed === 0
            ? "Not started"
            : `${completed} of ${total} complete`}
        </p>
      </div>
    </div>
  );
}

function FinanceProgress({ paid, total }: { paid: number; total: number }) {
  return (
    <div className="w-full">
      <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ops-muted">
        Tuition
      </p>
      <PaymentProgressBar paid={paid} total={total} />
    </div>
  );
}

function CancelledBlock() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-200 px-3 py-2 text-xs text-ops-muted">
      <X className="h-3.5 w-3.5" />
      Enrollment cancelled
    </div>
  );
}

// ──────────────────────── Inline action forms ────────────────────────

function CancelInline({
  enrollmentId,
  status,
  assessmentId,
  assessmentTotalPaid,
  canCancelWithBalance,
  portalBase,
}: {
  enrollmentId: string;
  status: EnrollmentStatus;
  assessmentId: string | null;
  assessmentTotalPaid: number | null;
  canCancelWithBalance: boolean;
  portalBase: "/admin" | "/staff";
}) {
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, {});
  const [show, setShow] = useState(false);
  const paid = assessmentTotalPaid ?? 0;
  const financeStatuses = status === "assessed" || status === "enrolled";
  const hasCollected = financeStatuses && paid > OUTSTANDING_PAYMENT_EPSILON;
  const cancelBlockedByPayments = hasCollected && !canCancelWithBalance;
  const remarksError = state.errors?.cancelRemarks?.[0];

  if (state.success) {
    return (
      <p className="rounded-md border border-[var(--color-accent-emerald)]/30 bg-[var(--color-accent-emerald)]/5 px-3 py-2 text-xs text-[var(--color-accent-emerald)]">
        ✓ {state.message}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700">
        Cancel enrollment
      </p>
      {!show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
        >
          <X className="h-3.5 w-3.5" />
          Begin cancellation
        </button>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="action" value="cancel" />

          {financeStatuses && assessmentId && (
            <Link
              href={withPortal(`/admin/assessments/${assessmentId}`, portalBase)}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] underline"
            >
              Open assessment ledger first
            </Link>
          )}

          {hasCollected && (
            <p
              className={cn(
                "rounded-md p-2 text-[11px] leading-relaxed",
                cancelBlockedByPayments
                  ? "bg-red-100/60 text-red-800"
                  : "bg-[var(--color-accent-amber)]/15 text-[var(--color-accent-amber)]"
              )}
            >
              {cancelBlockedByPayments ? (
                <>
                  Ledger shows <strong>{formatPhp(paid)}</strong> collected. Void posted payments via
                  the cashier first, then cancel.
                </>
              ) : (
                <>
                  Ledger shows <strong>{formatPhp(paid)}</strong> collected. Prefer voiding payments
                  before cancel; admin reason ≥ 15 chars required.
                </>
              )}
            </p>
          )}

          <textarea
            name="cancelRemarks"
            rows={hasCollected && canCancelWithBalance ? 4 : 2}
            placeholder={
              hasCollected && canCancelWithBalance
                ? "Detailed audit reason (≥ 15 characters)…"
                : "Reason for cancellation…"
            }
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-ops-ink outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-red-500/15"
          />

          {remarksError && (
            <p className="text-[11px] text-red-700">{remarksError}</p>
          )}
          {state.message && !state.success && (
            <p className="text-[11px] text-red-700">{state.message}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || cancelBlockedByPayments}
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all",
                "hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {pending ? "Cancelling…" : "Confirm cancellation"}
            </button>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="rounded-md px-2 py-1.5 text-xs text-ops-muted hover:text-ops-ink"
            >
              Dismiss
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function OverrideEnrollBlock({
  enrollmentId,
  sections,
}: {
  enrollmentId: string;
  sections: SectionOption[];
}) {
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, {});
  const [show, setShow] = useState(false);

  if (state.success) {
    return (
      <p className="rounded-md border border-[var(--color-accent-emerald)]/30 bg-[var(--color-accent-emerald)]/5 px-3 py-2 text-xs text-[var(--color-accent-emerald)]">
        ✓ {state.message}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-accent-amber)]/30 bg-[var(--color-accent-amber)]/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-amber)]">
        <ShieldCheck className="h-3 w-3" />
        Admin override
      </p>
      {!show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent-amber)]/40 bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-accent-amber)] transition-colors hover:bg-[var(--color-accent-amber)]/10"
        >
          Mark enrolled (no payment)
        </button>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="action" value="override_enroll" />
          <select
            name="sectionId"
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-ops-ink outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-[var(--color-primary)]/15"
          >
            <option value="">Section (optional)…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {state.message && !state.success && (
            <p className="text-[11px] text-red-700">{state.message}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Confirm override"}
            </button>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="rounded-md px-2 py-1.5 text-xs text-ops-muted hover:text-ops-ink"
            >
              Dismiss
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
