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
import { updateEnrollmentStatusAction } from "../enrollments.actions";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import { DocumentProgressRing } from "@/features/registrations/components/DocumentProgressRing";
import { PaymentProgressBar } from "@/features/enrollments";
import CancelEnrollmentForm, { type EnrollmentStatus } from "./CancelEnrollmentForm";
import { buttonVariants } from "@/components/ui/button";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import { cn } from "@/lib/utils/cn";
import { formatDate as formatDateLocalized } from "@/lib/utils/date";

// Re-export from CancelEnrollmentForm for backwards compatibility
export type { EnrollmentStatus } from "./CancelEnrollmentForm";

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

function formatDate(value: Date | null): string {
  return formatDateLocalized(value);
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
export default function EnrollmentCard({
  enrollment: en,
  sections,
  canManage,
  canCancel,
  canCancelWithBalance,
  canOverrideEnrolled,
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
          en.status === "pending" && "bg-warning",
          en.status === "assessed" && "bg-info",
          en.status === "enrolled" && "bg-success",
          en.status === "cancelled" && "bg-border"
        )}
      />

      <div className="px-6 py-5 pl-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: identity + meta */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h3 className="font-display text-xl font-bold uppercase leading-tight tracking-tight text-foreground">
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
              <code className="rounded bg-muted px-2 py-0.5 font-mono text-[12px] text-foreground">
                {en.referenceNumber}
              </code>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground">{en.gradeLevel}</span>
              {en.section && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Section {en.section}</span>
                </>
              )}
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{en.schoolYear}</span>
              <span className="text-muted-foreground">·</span>
              <span className="rounded-full bg-primary/[0.08] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                {TYPE_LABEL[en.studentType]}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
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
            <PrimaryAction enrollment={en} canManage={canManage} />
            <Link
              href={`/staff/students/${en.referenceNumber}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <User className="h-3.5 w-3.5" />
              Student profile
            </Link>
            {showActions && en.status !== "cancelled" && (
              <button
                type="button"
                onClick={() => setActionsOpen((o) => !o)}
                className="inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-5 md:grid-cols-2">
            {en.status === "assessed" && canOverrideEnrolled && (
              <OverrideEnrollBlock enrollmentId={en.id} sections={sections} />
            )}
            {canCancel && (
              <CancelEnrollmentForm
                enrollmentId={en.id}
                status={en.status}
                assessmentId={en.assessmentId}
                assessmentTotalPaid={en.assessmentTotalPaid}
                canCancelWithBalance={canCancelWithBalance}
                variant="card"
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
  canManage,
}: {
  enrollment: EnrollmentCardRow;
  canManage: boolean;
}) {
  if (en.status === "pending" && canManage) {
    return (
      <Link
        href={`/staff/assessments/new/${en.id}`}
        className={buttonVariants({ variant: "primary", size: "sm" })}
      >
        Build assessment
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  if (en.status === "assessed" && en.assessmentId) {
    return (
      <Link
        href={`/staff/assessments/${en.assessmentId}`}
        className={buttonVariants({ variant: "primary", size: "sm" })}
      >
        <Receipt className="h-3.5 w-3.5" />
        Open ledger
      </Link>
    );
  }

  if (en.status === "enrolled" && en.assessmentId) {
    return (
      <Link
        href={`/staff/assessments/${en.assessmentId}`}
        className={buttonVariants({ variant: "primary", size: "sm" })}
      >
        <Receipt className="h-3.5 w-3.5" />
        View ledger
      </Link>
    );
  }

  if (en.status === "cancelled" && canManage) {
    return (
      <Link
        href={`/staff/enrollments/new?studentId=${en.studentId}`}
        className={buttonVariants({ variant: "secondary", size: "sm" })}
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
    <div className="flex-row-3">
      <DocumentProgressRing completed={completed} total={total} size="sm" showLabel={false} />
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Intake
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">
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
      <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Tuition
      </p>
      <PaymentProgressBar paid={paid} total={total} />
    </div>
  );
}

function CancelledBlock() {
  return (
    <div className="flex-row-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      <X className="h-3.5 w-3.5" />
      Enrollment cancelled
    </div>
  );
}

// ──────────────────────── Inline action forms ────────────────────────

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
      <p className="rounded-md border border-success/25 bg-success/5 px-3 py-2 text-xs text-success">
        ✓ {state.message}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-warning/25 bg-warning/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">
        <ShieldCheck className="h-3 w-3" />
        Admin override
      </p>
      {!show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-card px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/10"
        >
          Mark enrolled (no payment)
        </button>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="action" value="override_enroll" />
          <select
            name="sectionId"
            className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none transition focus:border-input focus:ring-2 focus:ring-primary/15"
          >
            <option value="">Section (optional)…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {state.message && !state.success && (
            <p className="text-[11px] text-destructive">{state.message}</p>
          )}

          <div className="flex-row-2">
            <button
              type="submit"
              disabled={pending}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              {pending ? "Saving…" : "Confirm override"}
            </button>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
