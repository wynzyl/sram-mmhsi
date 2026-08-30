"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { SubjectOfferingView, TeacherOption } from "../subject-offerings.schema";
import type { StrandOption } from "@/features/academics/strands/strands.schema";
import { SubjectOfferingsTable } from "./SubjectOfferingsTable";
import {
  SHS_STRAND_SHORT_LABELS,
  SHS_STRAND_ORDER,
  SHS_STRAND_LABELS,
  type ShsStrandCode,
} from "@/lib/constants/strands";

type FilterCategory = "all" | "core" | ShsStrandCode;

/** Strand with enrolled student count */
export interface EnrolledStrandInfo {
  strandCode: ShsStrandCode;
  studentCount: number;
}

interface SubjectOfferingsByStrandProps {
  offerings: SubjectOfferingView[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
  canDelete: boolean;
  /** Strands that have enrolled students - used to show warnings for missing subjects */
  enrolledStrands?: EnrolledStrandInfo[];
  /** Available strands for track assignment */
  availableStrands?: StrandOption[];
  /** Whether user can change track assignment */
  canChangeTrack?: boolean;
}

/**
 * SubjectOfferingsByStrand - Displays subject offerings with strand-based filtering for SHS sections.
 *
 * Filter tabs:
 * - "All" - Shows all offerings
 * - "Core" - Shows universal core subjects (isCore = true, no strandCode)
 * - Strand tabs (STEM, ABM, etc.) - Shows strand-specific subjects
 */
export function SubjectOfferingsByStrand({
  offerings,
  teachers,
  canAssignTeacher,
  canDelete,
  enrolledStrands = [],
  availableStrands = [],
  canChangeTrack = false,
}: SubjectOfferingsByStrandProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");

  // Group offerings by category
  const { validOfferings, coreOfferings, strandGroups, strandCounts, offeringStrandTabs, missingStrandSubjects } = useMemo(() => {
    // Universal core subjects: isCore = true AND no strand restriction (strandCode = null)
    // These are taken by ALL students regardless of strand
    const core = offerings.filter((o) => o.isCore === true && !o.strandCode);

    // Strand-specific subjects: ANY offering with a strandCode (both core and electives)
    // This includes strand-specific core subjects (e.g., "Oral Communication" for STEM only)
    const byStrand = new Map<ShsStrandCode, SubjectOfferingView[]>();

    for (const offering of offerings) {
      if (offering.strandCode) {
        const strandCode = offering.strandCode as ShsStrandCode;
        const existing = byStrand.get(strandCode) || [];
        existing.push(offering);
        byStrand.set(strandCode, existing);
      }
    }

    // "All" shows every offering. Composing this list from `core` + `byStrand`
    // silently dropped a fourth case: a NON-core offering with no track, which
    // arises both from generating an elective whose subject has no strand
    // associations and from switching an elective to "All Tracks". Such an
    // offering matched no tab at all — and because the row is what opens
    // ChangeTrackDialog, its track could never be changed back.
    const valid = offerings;

    // Build strand counts for badges
    const counts: Partial<Record<ShsStrandCode, number>> = {};
    for (const [strand, items] of byStrand.entries()) {
      counts[strand] = items.length;
    }

    // Get strand tabs from offerings (sorted by order)
    const tabs = Array.from(byStrand.keys()).sort(
      (a, b) => SHS_STRAND_ORDER[a] - SHS_STRAND_ORDER[b]
    );

    // Find strands with enrolled students but no subject offerings
    const missingSubjects: EnrolledStrandInfo[] = [];
    for (const enrolled of enrolledStrands) {
      if (!byStrand.has(enrolled.strandCode)) {
        missingSubjects.push(enrolled);
      }
    }

    return {
      validOfferings: valid,
      coreOfferings: core,
      strandGroups: byStrand,
      strandCounts: counts,
      offeringStrandTabs: tabs,
      missingStrandSubjects: missingSubjects,
    };
  }, [offerings, enrolledStrands]);

  // Filter offerings based on active filter
  const filteredOfferings = useMemo(() => {
    switch (activeFilter) {
      case "all":
        return validOfferings;
      case "core":
        // Universal core only — trackless electives stay out of this tab.
        return coreOfferings;
      default:
        // Strand filter: only strand-specific electives
        return strandGroups.get(activeFilter) || [];
    }
  }, [activeFilter, validOfferings, coreOfferings, strandGroups]);

  return (
    <div className="space-y-4">
      {/* Warning for strands with students but no subjects */}
      {missingStrandSubjects.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-warning-tint border border-warning/25 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">
                Missing strand-specific subjects
              </p>
              <p className="text-sm text-warning mt-1">
                The following strands have enrolled students but no strand-specific subject offerings:
              </p>
              <ul className="mt-2 text-sm text-warning list-disc list-inside">
                {missingStrandSubjects.map((strand) => (
                  <li key={strand.strandCode}>
                    <strong>{strand.strandCode}</strong> ({SHS_STRAND_LABELS[strand.strandCode]}) — {strand.studentCount} student{strand.studentCount !== 1 ? "s" : ""}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-warning mt-2">
                Add strand-specific subjects to the curriculum and regenerate offerings, or these students will only have core subjects.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        {/* All tab - excludes unassigned electives */}
        <FilterButton
          active={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
          label="All"
          count={validOfferings.length}
        />

        {/* Core tab */}
        <FilterButton
          active={activeFilter === "core"}
          onClick={() => setActiveFilter("core")}
          label="Core"
          count={coreOfferings.length}
          variant="info"
        />

        {/* Divider */}
        {offeringStrandTabs.length > 0 && (
          <div className="h-6 w-px bg-border mx-1" />
        )}

        {/* Strand tabs - shows only strand-specific electives */}
        {offeringStrandTabs.map((strand) => (
          <FilterButton
            key={strand}
            active={activeFilter === strand}
            onClick={() => setActiveFilter(strand)}
            label={SHS_STRAND_SHORT_LABELS[strand]}
            count={strandCounts[strand] || 0}
            variant="secondary"
          />
        ))}
      </div>

      {/* Filter description */}
      <div className="px-4 text-sm text-muted-foreground">
        {activeFilter === "all" && "Showing all subject offerings for this section"}
        {activeFilter === "core" && "Showing universal core subjects (taken by all students regardless of strand)"}
        {activeFilter !== "all" && activeFilter !== "core" && (
          <>Showing subjects for <strong>{activeFilter}</strong> strand (core and electives)</>
        )}
      </div>

      {/* Offerings Table */}
      <SubjectOfferingsTable
        offerings={filteredOfferings}
        teachers={teachers}
        canAssignTeacher={canAssignTeacher}
        canDelete={canDelete}
        showTermColumn={true}
        availableStrands={availableStrands}
        canChangeTrack={canChangeTrack}
      />
    </div>
  );
}

// ─── Filter Button Component ─────────────────────────────────────────────────

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  variant?: "default" | "info" | "secondary";
}

function FilterButton({
  active,
  onClick,
  label,
  count,
  variant = "default",
}: FilterButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "primary" : "secondary"}
      size="sm"
      onClick={onClick}
      className={cn(
        "gap-2 transition-colors",
        active && variant === "info" && "bg-info hover:bg-info border-info"
      )}
    >
      {label}
      <Badge
        variant="secondary"
        className={cn(
          "ml-1 px-1.5 py-0 text-xs font-normal",
          active && "bg-white/20 text-white border-white/30"
        )}
      >
        {count}
      </Badge>
    </Button>
  );
}
