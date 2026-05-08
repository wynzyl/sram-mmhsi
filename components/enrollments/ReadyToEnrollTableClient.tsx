"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReadyToEnrollTable } from "./ReadyToEnrollTable";
import { EnrollmentConfirmationDrawer } from "./EnrollmentConfirmationDrawer";
import { PaginationControls } from "@/components/shared/PaginationControls";
import type { ReadyToEnrollStudent } from "@/lib/queries/enrollment-queue";
import type { PaginatedResult } from "@/lib/types/pagination";

type ReadyToEnrollTableClientProps = {
  paginatedData: PaginatedResult<ReadyToEnrollStudent>;
  schoolYearId: string;
  sections?: Array<{ id: string; name: string }>;
  gradeLevels?: Array<{ id: string; name: string }>;
  searchQuery?: string;
  gradeLevelFilter?: string;
  basePath: string;
};

/**
 * Client wrapper for ReadyToEnrollTable with interactive confirmation drawer.
 *
 * This component manages the state for the enrollment confirmation workflow:
 * - Opens drawer when "Enroll" button is clicked
 * - Handles successful enrollment (refresh page)
 * - Provides sections for optional assignment
 * - Uses global filters from URL params
 */
export function ReadyToEnrollTableClient({
  paginatedData,
  schoolYearId,
  sections = [],
  gradeLevels = [],
  searchQuery = "",
  gradeLevelFilter = "",
  basePath,
}: ReadyToEnrollTableClientProps) {
  const router = useRouter();
  const [selectedStudent, setSelectedStudent] = useState<ReadyToEnrollStudent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleConfirmEnrollment = (student: ReadyToEnrollStudent) => {
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

      <PaginationControls pagination={paginatedData.pagination} basePath={basePath} />

      {selectedStudent && (
        <EnrollmentConfirmationDrawer
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
