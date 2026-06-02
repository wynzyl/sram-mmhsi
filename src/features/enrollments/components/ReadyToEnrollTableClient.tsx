"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import ReadyToEnrollTable from "./ReadyToEnrollTable";
import EnrollmentConfirmationDrawer from "./EnrollmentConfirmationDrawer";
import { TablePagination } from "@/components/ui/TablePagination";
import type { ReadyToEnrollListRow } from "../enrollments-queue.queries";
import type { PaginatedResult } from "@/lib/types/pagination";

type ReadyToEnrollTableClientProps = {
  paginatedData: PaginatedResult<ReadyToEnrollListRow>;
  schoolYearId: string;
  sections?: Array<{ id: string; name: string }>;
  gradeLevels?: Array<{ id: string; name: string }>;
  searchQuery?: string;
  gradeLevelFilter?: string;
};

/**
 * Client wrapper for ReadyToEnrollTable with interactive confirmation drawer.
 *
 * This component manages the state for the enrollment confirmation workflow:
 * - Opens drawer when "Enroll" button is clicked
 * - Lazy-loads full student details (including intakeDocuments) when drawer opens
 * - Handles successful enrollment (refresh page)
 * - Provides sections for optional assignment
 * - Uses global filters from URL params
 */
export default function ReadyToEnrollTableClient({
  paginatedData,
  schoolYearId,
  sections = [],
  gradeLevels = [],
  searchQuery = "",
  gradeLevelFilter = "",
}: ReadyToEnrollTableClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedStudent, setSelectedStudent] = useState<ReadyToEnrollListRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Build base URL for pagination (preserving current filters)
  const paginationBaseUrl = useMemo(() => {
    const params = new URLSearchParams();
    // Preserve the current tab from URL
    const currentTab = searchParams.get("tab");
    if (currentTab) params.set("tab", currentTab);
    if (searchQuery) params.set("search", searchQuery);
    if (gradeLevelFilter && gradeLevelFilter !== "all") params.set("gradeLevel", gradeLevelFilter);
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams, searchQuery, gradeLevelFilter]);

  const handleConfirmEnrollment = (student: ReadyToEnrollListRow) => {
    setSelectedStudent(student);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedStudent(null);
  };

  const handleSuccess = (enrollmentId: string) => {
    console.log("✅ Enrollment confirmed:", enrollmentId);

    // Refresh the page to update the queue
    router.refresh();

    // Could add toast notification here if you have a toast system
    // toast.success("Enrollment confirmed successfully!");
  };

  return (
    <>
      <ReadyToEnrollTable
        students={paginatedData.data}
        onConfirmEnrollment={handleConfirmEnrollment}
        gradeLevels={gradeLevels}
        searchQuery={searchQuery}
        gradeLevelFilter={gradeLevelFilter}
      />

      <TablePagination
        currentPage={paginatedData.pagination.page}
        totalPages={paginatedData.pagination.totalPages}
        totalRecords={paginatedData.pagination.totalRecords}
        pageSize={paginatedData.pagination.pageSize}
        baseUrl={paginationBaseUrl}
        itemLabel="students"
      />

      {selectedStudent && isDrawerOpen && (
        <EnrollmentConfirmationDrawer
          key={selectedStudent.studentId}
          student={selectedStudent}
          schoolYearId={schoolYearId}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onSuccess={handleSuccess}
          sections={sections}
        />
      )}
    </>
  );
}
