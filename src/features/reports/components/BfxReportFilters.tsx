"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SchoolYear {
  id: string;
  label: string;
}

interface BfxReportFiltersProps {
  schoolYears: SchoolYear[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultSchoolYearId?: string;
}

export function BfxReportFilters({
  schoolYears,
  defaultStartDate,
  defaultEndDate,
  defaultSchoolYearId,
}: BfxReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize with URL params or defaults
  const [startDate, setStartDate] = useState(
    defaultStartDate || searchParams.get("startDate") || ""
  );
  const [endDate, setEndDate] = useState(
    defaultEndDate || searchParams.get("endDate") || ""
  );
  const [schoolYearId, setSchoolYearId] = useState(
    defaultSchoolYearId || searchParams.get("schoolYearId") || ""
  );

  const handleApply = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    router.push(`/staff/reports/balance-forwards?${params.toString()}`);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSchoolYearId("");
    router.push("/staff/reports/balance-forwards");
  };

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="startDate"
          className="text-sm font-medium text-[var(--color-text-muted)]"
        >
          Start Date
        </label>
        <Input
          type="date"
          id="startDate"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="endDate"
          className="text-sm font-medium text-[var(--color-text-muted)]"
        >
          End Date
        </label>
        <Input
          type="date"
          id="endDate"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="schoolYearId"
          className="text-sm font-medium text-[var(--color-text-muted)]"
        >
          Source School Year
        </label>
        <select
          id="schoolYearId"
          value={schoolYearId}
          onChange={(e) => setSchoolYearId(e.target.value)}
          className="h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        >
          <option value="">All Years</option>
          {schoolYears.map((sy) => (
            <option key={sy.id} value={sy.id}>
              {sy.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={handleApply}>
          Apply Filters
        </Button>
        <Button type="button" variant="secondary" onClick={handleReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
