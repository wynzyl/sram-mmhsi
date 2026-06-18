"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/forms/SelectField";

interface SchoolYear {
  id: string;
  label: string;
}

interface AccountsReceivableFiltersProps {
  schoolYears: SchoolYear[];
  defaultSchoolYearId?: string;
}

export function AccountsReceivableFilters({
  schoolYears,
  defaultSchoolYearId,
}: AccountsReceivableFiltersProps) {
  const router = useRouter();
  const [schoolYearId, setSchoolYearId] = useState(defaultSchoolYearId ?? "");

  const handleApply = () => {
    const params = new URLSearchParams();
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    const queryString = params.toString();
    router.push(
      `/staff/reports/accounts-receivable${queryString ? `?${queryString}` : ""}`,
    );
  };

  const handleReset = () => {
    setSchoolYearId("");
    router.push("/staff/reports/accounts-receivable");
  };

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-card border border-border rounded-lg">
      <SelectField
        label="School Year"
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
