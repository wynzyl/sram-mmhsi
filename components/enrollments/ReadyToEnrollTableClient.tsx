"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReadyToEnrollTable } from "./ReadyToEnrollTable";
import { EnrollmentConfirmationDrawer } from "./EnrollmentConfirmationDrawer";
import type { ReadyToEnrollStudent } from "@/lib/queries/enrollment-queue";

type ReadyToEnrollTableClientProps = {
  students: ReadyToEnrollStudent[];
  schoolYearId: string;
  sections?: Array<{ id: string; name: string }>;
};

/**
 * Client wrapper for ReadyToEnrollTable with interactive confirmation drawer.
 *
 * This component manages the state for the enrollment confirmation workflow:
 * - Opens drawer when "Enroll" button is clicked
 * - Handles successful enrollment (refresh page)
 * - Provides sections for optional assignment
 */
export function ReadyToEnrollTableClient({
  students,
  schoolYearId,
  sections = [],
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
      <ReadyToEnrollTable students={students} onConfirmEnrollment={handleConfirmEnrollment} />

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
