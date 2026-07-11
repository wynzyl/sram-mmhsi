"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

interface GradeTabsNavProps {
  gradeLevels: { id: string; name: string }[];
  selectedGradeId: string | null;
}

/**
 * Pill-style grade level tab navigation
 * Updates URL search params when grade is selected
 */
export default function GradeTabsNav({
  gradeLevels,
  selectedGradeId,
}: GradeTabsNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleGradeSelect = useCallback(
    (gradeId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("grade", gradeId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="pill-tabs">
      {gradeLevels.map((grade) => (
        <button
          key={grade.id}
          type="button"
          onClick={() => handleGradeSelect(grade.id)}
          className={`pill-tab ${
            selectedGradeId === grade.id ? "pill-tab-active" : ""
          }`}
        >
          {grade.name}
        </button>
      ))}
    </div>
  );
}
