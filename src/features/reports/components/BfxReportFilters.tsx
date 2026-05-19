"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";

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
      <TextInputField
        label="Start Date"
        name="startDate"
        type="date"
        value={startDate}
        onChange={setStartDate}
        className="w-40"
      />

      <TextInputField
        label="End Date"
        name="endDate"
        type="date"
        value={endDate}
        onChange={setEndDate}
        className="w-40"
      />

      <SelectField
        label="Source School Year"
        name="schoolYearId"
        value={schoolYearId}
        onChange={setSchoolYearId}
        options={[
          { value: "", label: "All Years" },
          ...schoolYears.map((sy) => ({ value: sy.id, label: sy.label })),
        ]}
      />

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
