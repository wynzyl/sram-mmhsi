"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/forms/SelectField";

interface Option {
  id: string;
  label: string;
}

interface StudentListFiltersProps {
  schoolYears: Option[];
  gradeLevels: Option[];
  schoolYearId: string;
  gradeLevelId?: string;
}

export function StudentListFilters({
  schoolYears,
  gradeLevels,
  schoolYearId: defaultSchoolYearId,
  gradeLevelId: defaultGradeLevelId,
}: StudentListFiltersProps) {
  const router = useRouter();
  const [schoolYearId, setSchoolYearId] = useState(defaultSchoolYearId);
  const [gradeLevelId, setGradeLevelId] = useState(defaultGradeLevelId ?? "");

  const handleApply = () => {
    const params = new URLSearchParams();
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    if (gradeLevelId) params.set("gradeLevelId", gradeLevelId);
    router.push(`/staff/reports/student-list?${params.toString()}`);
  };

  const handleReset = () => {
    setSchoolYearId(defaultSchoolYearId);
    setGradeLevelId("");
    router.push("/staff/reports/student-list");
  };

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-card border border-border rounded-lg">
      <SelectField
        label="School Year"
        name="schoolYearId"
        value={schoolYearId}
        onChange={setSchoolYearId}
        options={schoolYears.map((sy) => ({ value: sy.id, label: sy.label }))}
      />

      <SelectField
        label="Grade Level"
        name="gradeLevelId"
        value={gradeLevelId}
        onChange={setGradeLevelId}
        options={[
          { value: "", label: "All Grades" },
          ...gradeLevels.map((g) => ({ value: g.id, label: g.label })),
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
