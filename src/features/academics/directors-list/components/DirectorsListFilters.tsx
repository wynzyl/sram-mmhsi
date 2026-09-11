"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, FileSpreadsheet, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface GradeLevelOption {
  id: string;
  name: string;
}

interface SectionOption {
  id: string;
  name: string;
}

interface GradingPeriodOption {
  value: string;
  label: string;
}

interface DirectorsListFiltersProps {
  schoolYears: SchoolYearOption[];
  gradeLevels: GradeLevelOption[];
  sections: SectionOption[];
  gradingPeriods: GradingPeriodOption[];
  defaults: {
    schoolYearId: string;
    gradingPeriod: string;
    gradeLevelId?: string;
    sectionId?: string;
  };
  /** Whether data is currently loading */
  isLoading?: boolean;
}

/**
 * Filter controls for Director's List.
 * Includes school year, grading period, grade level, and section filters.
 */
export function DirectorsListFilters({
  schoolYears,
  gradeLevels,
  sections,
  gradingPeriods,
  defaults,
  isLoading = false,
}: DirectorsListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [schoolYearId, setSchoolYearId] = useState(defaults.schoolYearId);
  const [gradingPeriod, setGradingPeriod] = useState(defaults.gradingPeriod);
  const [gradeLevelId, setGradeLevelId] = useState(defaults.gradeLevelId ?? "");
  const [sectionId, setSectionId] = useState(defaults.sectionId ?? "");

  // Filter sections by selected grade level
  const filteredSections = gradeLevelId
    ? sections.filter((s) => {
        // This requires section data to include gradeLevelId
        // For now, show all sections if not filtered
        return true;
      })
    : sections;

  const applyFilters = useCallback(() => {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("schoolYearId", schoolYearId);
      params.set("gradingPeriod", gradingPeriod);
      if (gradeLevelId) params.set("gradeLevelId", gradeLevelId);
      if (sectionId) params.set("sectionId", sectionId);
      router.push(`/staff/grades/directors-list?${params.toString()}`);
    });
  }, [router, schoolYearId, gradingPeriod, gradeLevelId, sectionId]);

  const resetFilters = useCallback(() => {
    startTransition(() => {
      setGradeLevelId("");
      setSectionId("");
      const params = new URLSearchParams();
      params.set("schoolYearId", defaults.schoolYearId);
      params.set("gradingPeriod", defaults.gradingPeriod);
      router.push(`/staff/grades/directors-list?${params.toString()}`);
    });
  }, [router, defaults]);

  const hasFilters = gradeLevelId !== "" || sectionId !== "";

  // Build export URL with current filters
  const buildExportUrl = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", format);
    return `/staff/reports/directors-list/export?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap gap-3">
        {/* School Year */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            School Year
          </label>
          <Select
            value={schoolYearId}
            onValueChange={(v) => {
              setSchoolYearId(v);
              // Reset period when school year changes
              const newParams = new URLSearchParams();
              newParams.set("schoolYearId", v);
              newParams.set("gradingPeriod", gradingPeriod);
              router.push(`/staff/grades/directors-list?${newParams.toString()}`);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map((sy) => (
                <SelectItem key={sy.id} value={sy.id}>
                  {sy.label}
                  {sy.isActive && " (Active)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grading Period */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Grading Period
          </label>
          <Select
            value={gradingPeriod}
            onValueChange={(v) => {
              setGradingPeriod(v);
              const newParams = new URLSearchParams(searchParams.toString());
              newParams.set("gradingPeriod", v);
              router.push(`/staff/grades/directors-list?${newParams.toString()}`);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gradingPeriods.map((gp) => (
                <SelectItem key={gp.value} value={gp.value}>
                  {gp.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grade Level */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Grade Level
          </label>
          <Select value={gradeLevelId} onValueChange={setGradeLevelId}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Levels</SelectItem>
              {gradeLevels.map((gl) => (
                <SelectItem key={gl.id} value={gl.id}>
                  {gl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section (optional) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Section
          </label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Sections</SelectItem>
              {filteredSections.map((sec) => (
                <SelectItem key={sec.id} value={sec.id}>
                  {sec.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Apply / Reset */}
        <div className="flex items-end gap-2">
          <Button onClick={applyFilters} disabled={isPending || isLoading}>
            {isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
            ) : null}
            Apply
          </Button>
          {hasFilters && (
            <Button variant="secondary" onClick={resetFilters} disabled={isPending}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Export Dropdown */}
      <div className="flex items-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={buildExportUrl("pdf")} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={buildExportUrl("xlsx")} target="_blank" rel="noopener noreferrer">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
