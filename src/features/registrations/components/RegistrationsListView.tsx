"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import { DocumentProgressRing } from "./DocumentProgressRing";
import { StudentRowActionsMenu } from "@/features/students/components/StudentRowActionsMenu";
import { SearchInput } from "@/components/shared/SearchInput";
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
    <div className="space-y-6">
      {showQueueHeading ? (
        <SectionHeader
          title="REGISTRATIONS"
          subtitle={`${queueTotal.toLocaleString()} approved registration${queueTotal !== 1 ? "s" : ""} pending current-year enrollment`}
          accent
        />
      ) : (
        <p className="font-mono text-secondary">
          {queueTotal.toLocaleString()} in queue
          {debouncedSearch
            ? ` · showing ${filteredRegistrations.length} on this page after search`
            : null}
        </p>
      )}

      {/* Search bar */}
      <SearchInput
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Search by name, reference, or grade level..."
        showClear
      />

      {/* Registration cards grid */}
      {filteredRegistrations.length === 0 ? (
        <DataCard className="p-12 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
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

      {/* Results count */}
      {debouncedSearch && (
        <p className="text-center text-secondary">
          Showing {filteredRegistrations.length} of {registrations.length} registrations
        </p>
      )}
    </div>
  );
}
