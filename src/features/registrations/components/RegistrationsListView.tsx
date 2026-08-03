"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Download } from "lucide-react";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import { DocumentProgressRing } from "./DocumentProgressRing";
import { StudentRowActionsMenu } from "@/features/students/components/StudentRowActionsMenu";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import { registrationStudentTypeLabel } from "@/lib/utils/intake-documents";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { useDebounce } from "@/hooks/useDebounce";

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
  studentBasePath = "/staff/students",
}: RegistrationsListViewProps) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const queueTotal = totalCount ?? registrations.length;

  // Client-side search filtering with debounced value
  const filteredRegistrations = useMemo(() => {
    if (!debouncedSearch) return registrations;
    const query = debouncedSearch.toLowerCase();
    return registrations.filter((reg) => {
      return (
        reg.studentName.toLowerCase().includes(query) ||
        reg.referenceNumber.toLowerCase().includes(query) ||
        reg.gradeLevel.toLowerCase().includes(query)
      );
    });
  }, [registrations, debouncedSearch]);

  return (
    <div className="page-container--full space-y-6">
      {/* Clean Page Header - Title + Subtitle Only */}
      {showQueueHeading && (
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
            Registrations
          </h1>
          <p className="text-sm text-muted-foreground">
            Current Academic Session • {queueTotal.toLocaleString()} Approved Registration{queueTotal !== 1 ? "s" : ""} Pending Enrollment
          </p>
        </div>
      )}

      {/* Registration Card with Embedded Controls */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Card Header - ALL controls here */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + Count Badge */}
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Registration Queue
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {queueTotal} Record{queueTotal !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Right: All Controls - Inline Row */}
          <div className="flex items-center gap-2">
            {/* Search Input - Desktop */}
            <div className="hidden md:flex items-stretch rounded-md border border-border bg-muted/50 w-48">
              <span className="flex items-center pl-3 pr-2 text-muted-foreground pointer-events-none">
                <Search className="h-4 w-4 shrink-0" aria-hidden />
              </span>
              <input
                type="search"
                className="min-h-10 flex-1 bg-transparent py-2 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Quick search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Clear Search */}
            {debouncedSearch && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}

            {/* Export CSV Button */}
            <button
              type="button"
              disabled
              title="Export CSV is not available yet."
              className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 min-h-10 text-xs font-semibold text-muted-foreground cursor-not-allowed opacity-70 whitespace-nowrap"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Export CSV
            </button>
          </div>
        </div>

        {/* Mobile Search Row */}
        <div className="flex md:hidden border-b border-border px-4 py-2">
          <div className="flex items-stretch rounded-md border border-border bg-muted/50 w-full">
            <span className="flex items-center pl-3 pr-2 text-muted-foreground pointer-events-none">
              <Search className="h-4 w-4 shrink-0" aria-hidden />
            </span>
            <input
              type="search"
              className="min-h-10 flex-1 bg-transparent py-2 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Search registrations..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Card Content */}
        {filteredRegistrations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid gap-4 p-4">
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
                        <h3 className="mb-2 truncate font-display text-2xl font-bold text-foreground">
                          {reg.studentName}
                        </h3>

                        {/* Metadata row */}
                        <div className="mb-4 flex flex-wrap items-center gap-3 text-secondary">
                          <code className="rounded bg-gray-200 px-2 py-0.5 font-mono text-foreground dark:bg-gray-800">
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
                          <span className="text-secondary">Requirements:</span>
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
                        <p className="mt-3 text-helper">
                          Registered{" "}
                          {formatDate(reg.createdAt, {
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
                                     text-primary hover:bg-muted
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

        {/* Card Footer - Results count */}
        {filteredRegistrations.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {filteredRegistrations.length} of {registrations.length} registration{registrations.length !== 1 ? "s" : ""}
              {debouncedSearch && " matching search"}
            </span>
          </div>
        )}
      </section>

      <p className="text-center text-[0.7rem] text-muted-foreground pb-2">
        Confidential institutional data. Authorized access only.
      </p>
    </div>
  );
}
