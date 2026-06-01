"use client";

import { Button } from "@/components/ui/button";

interface StudentListReportActionsProps {
  schoolYearId: string;
  gradeLevelId?: string;
}

export function StudentListReportActions({
  schoolYearId,
  gradeLevelId,
}: StudentListReportActionsProps) {
  const download = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    if (gradeLevelId) params.set("gradeLevelId", gradeLevelId);

    // Trigger download without navigating (filename comes from the server).
    const a = document.createElement("a");
    a.href = `/staff/reports/student-list/export?${params.toString()}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="flex items-center gap-2 no-print">
      <Button type="button" variant="secondary" onClick={() => download("pdf")}>
        <svg
          className="w-4 h-4 mr-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Export PDF
      </Button>
      <Button type="button" variant="secondary" onClick={() => download("xlsx")}>
        <svg
          className="w-4 h-4 mr-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M9 13l6 6M15 13l-6 6" />
        </svg>
        Export Excel
      </Button>
    </div>
  );
}
