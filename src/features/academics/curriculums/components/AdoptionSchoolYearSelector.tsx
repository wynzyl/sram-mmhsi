"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface AdoptionSchoolYearSelectorProps {
  schoolYears: SchoolYearOption[];
  selectedYearId: string;
}

export function AdoptionSchoolYearSelector({
  schoolYears,
  selectedYearId,
}: AdoptionSchoolYearSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSchoolYearChange = (newYearId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("schoolYearId", newYearId);
    startTransition(() => {
      router.push(`/staff/academics/curriculums/adoptions?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-4">
      <label htmlFor="school-year-select" className="text-sm font-medium">
        School Year:
      </label>
      <Select
        value={selectedYearId}
        onValueChange={handleSchoolYearChange}
        disabled={isPending}
      >
        <SelectTrigger id="school-year-select" className="w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {schoolYears.map((sy) => (
            <SelectItem key={sy.id} value={sy.id}>
              {sy.label}
              {sy.isActive && (
                <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                  (Active)
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && (
        <span className="text-xs text-muted-foreground">Loading...</span>
      )}
    </div>
  );
}
