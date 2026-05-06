"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import { DocumentProgressRing } from "./DocumentProgressRing";
import { StudentRowActionsMenu } from "@/components/students/StudentRowActionsMenu";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import { registrationStudentTypeLabel } from "@/lib/utils/intake-documents";
import { cn } from "@/lib/utils/cn";

export interface RegistrationRow {
  id: string;
  studentId: string;
  studentName: string;
  referenceNumber: string;
  schoolYear: string;
  gradeLevel: string;
  studentType: string;
  intakeDocuments: EnrollmentIntakeDocuments | null;
  createdAt: Date;
}

interface RegistrationsListViewProps {
  registrations: RegistrationRow[];
  /** Total rows matching server filters (e.g. all pages), for accurate queue copy. */
  totalCount?: number;
  /** When false, omit the built-in editorial heading (parent page supplies the title). */
  showQueueHeading?: boolean;
  emptyMessage?: string;
  studentBasePath?: "/admin/students" | "/staff/students";
}

const STAGGER_CLASSES = [
  "stagger-delay-1",
  "stagger-delay-2",
  "stagger-delay-3",
  "stagger-delay-4",
  "stagger-delay-5",
] as const;

/**
 * Count completed intake documents for progress visualization
 */
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
    (field) => field === "received" || field === "not_applicable"
  ).length;

  return { completed, total: 5 };
}

/**
 * Card-based registration list view with staggered animations and editorial design.
 * Replaces the traditional table view for a more modern, scannable interface.
 */
export default function RegistrationsListView({
  registrations,
  totalCount,
  showQueueHeading = true,
  emptyMessage = "No registrations found.",
  studentBasePath = "/admin/students",
}: RegistrationsListViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const queueTotal = totalCount ?? registrations.length;

  // Client-side search filtering
  const filteredRegistrations = registrations.filter((reg) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      reg.studentName.toLowerCase().includes(query) ||
      reg.referenceNumber.toLowerCase().includes(query) ||
      reg.gradeLevel.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {showQueueHeading ? (
        <SectionHeader
          title="REGISTRATIONS"
          subtitle={`${queueTotal.toLocaleString()} approved registration${queueTotal !== 1 ? "s" : ""} pending current-year enrollment`}
          accent
        />
      ) : (
        <p className="font-mono text-sm text-(--color-text-muted)">
          {queueTotal.toLocaleString()} in queue
          {searchQuery
            ? ` · showing ${filteredRegistrations.length} on this page after search`
            : null}
        </p>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-text-muted)" />
        <input
          type="text"
          placeholder="Search by name, reference, or grade level..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-(--color-border) bg-(--color-surface) py-3 pl-10 pr-4
                     text-(--color-text) shadow-(--shadow-sm) focus:border-(--color-border-2) focus:outline-none focus:ring-2 focus:ring-(--color-border-2)/40
                     transition-all duration-150"
        />
      </div>

      {/* Registration cards grid */}
      {filteredRegistrations.length === 0 ? (
        <DataCard className="p-12 text-center">
          <p className="text-(--color-text-muted)">{emptyMessage}</p>
        </DataCard>
      ) : (
        <div className="grid gap-4">
          {filteredRegistrations.map((reg, index) => {
            const docProgress = countIntakeDocuments(reg.intakeDocuments);
            const staggerClass = STAGGER_CLASSES[Math.min(index, STAGGER_CLASSES.length - 1)];

            return (
              <DataCard
                key={reg.id}
                hoverable
                className={cn("animate-reveal-stagger opacity-0", staggerClass)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-6">
                    {/* Left column: Student info */}
                    <div className="flex-1 min-w-0">
                      {/* Student name (large) */}
                      <h3 className="mb-2 truncate font-display text-2xl font-bold text-(--color-text)">
                        {reg.studentName}
                      </h3>

                      {/* Metadata row */}
                      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-(--color-text-muted)">
                        <code className="rounded bg-(--color-surface-3) px-2 py-0.5 font-mono text-(--color-text)">
                          {reg.referenceNumber}
                        </code>
                        <span>•</span>
                        <span className="font-medium">{reg.gradeLevel}</span>
                        <span>•</span>
                        <span>{reg.schoolYear}</span>
                        <span>•</span>
                        <span className="capitalize">
                          {registrationStudentTypeLabel(reg.studentType)}
                        </span>
                      </div>

                      {/* Document status with inline progress */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-(--color-text-muted)">Requirements:</span>
                        {docProgress.completed === docProgress.total ? (
                          <StatusIndicator status="complete" size="sm" />
                        ) : docProgress.completed > 0 ? (
                          <StatusIndicator
                            status="pending"
                            label={`${docProgress.completed} of ${docProgress.total}`}
                            size="sm"
                          />
                        ) : (
                          <StatusIndicator status="to-follow" size="sm" />
                        )}
                      </div>

                      {/* Registration date */}
                      <p className="mt-3 text-xs text-(--color-text-muted)">
                        Registered{" "}
                        {new Date(reg.createdAt).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    {/* Middle column: Document progress ring */}
                    <div className="flex items-center justify-center shrink-0">
                      <DocumentProgressRing
                        completed={docProgress.completed}
                        total={docProgress.total}
                        size="md"
                      />
                    </div>

                    {/* Right column: Actions */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <Link
                        href={`${studentBasePath}/${reg.studentId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium
                                   text-(--color-primary) hover:bg-(--color-surface-3)
                                   transition-colors group"
                      >
                        View
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </Link>

                      <StudentRowActionsMenu
                        studentId={reg.studentId}
                        studentBasePath={studentBasePath}
                      />
                    </div>
                  </div>
                </div>
              </DataCard>
            );
          })}
        </div>
      )}

      {/* Results count */}
      {searchQuery && (
        <p className="text-center text-sm text-(--color-text-muted)">
          Showing {filteredRegistrations.length} of {registrations.length} registrations
        </p>
      )}
    </div>
  );
}
