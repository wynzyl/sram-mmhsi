"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { XCircle, ChevronDown, ChevronUp } from "lucide-react";

export interface CancelEnrollmentButtonProps {
  enrollmentId: string;
  enrollmentStatus: string;
}

/**
 * Simple button that links to cancel action.
 * Clicking scrolls to the cancellation section at the bottom of the page.
 */
export default function CancelEnrollmentButton({
  enrollmentId,
  enrollmentStatus,
}: CancelEnrollmentButtonProps) {
  // Don't show for cancelled enrollments
  if (enrollmentStatus === "cancelled") {
    return null;
  }

  const isDirectCancel = enrollmentStatus === "pending" || enrollmentStatus === "assessed";
  const buttonLabel = isDirectCancel ? "Cancel" : "Request Cancel";

  const handleClick = () => {
    // Scroll to the cancellation section at the bottom
    const section = document.getElementById("enrollment-cancellation-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <Button
      variant="danger-outline"
      size="sm"
      className="gap-1.5"
      onClick={handleClick}
    >
      <XCircle className="h-4 w-4" />
      {buttonLabel}
    </Button>
  );
}
