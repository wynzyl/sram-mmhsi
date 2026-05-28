import Link from "next/link";
import { XCircle, AlertTriangle, Clock } from "lucide-react";

export interface EnrollmentCancelActionProps {
  enrollmentId: string;
  enrollmentStatus: string;
  schoolYearIsActive: boolean;
  hasPendingCancellation?: boolean;
}

/**
 * Action link for enrollment cancellation in the enrollment history table.
 * - For non-active school years: shows nothing (historical records)
 * - For cancelled enrollments: shows nothing
 * - For enrollments with pending cancellation: shows "Pending" indicator
 * - For pending/assessed: links to enrollment detail for direct cancel
 * - For enrolled: links to enrollment detail to request cancellation
 */
export default function EnrollmentCancelAction({
  enrollmentId,
  enrollmentStatus,
  schoolYearIsActive,
  hasPendingCancellation = false,
}: EnrollmentCancelActionProps) {
  // Don't show anything for non-active school years (historical enrollments)
  if (!schoolYearIsActive) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Don't show anything for cancelled enrollments
  if (enrollmentStatus === "cancelled") {
    return <span className="text-muted-foreground">—</span>;
  }

  // Show pending indicator if there's a pending cancellation request
  if (hasPendingCancellation) {
    return (
      <span
        className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"
        title="Cancellation request is pending review"
      >
        <Clock className="h-3.5 w-3.5" />
        Pending
      </span>
    );
  }

  const isDirectCancel = enrollmentStatus === "pending" || enrollmentStatus === "assessed";

  return (
    <Link
      href={`/staff/enrollments/${enrollmentId}#enrollment-cancellation-section`}
      className="inline-flex items-center h-7 px-2 text-xs text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted"
      title={
        isDirectCancel
          ? `Cancel this ${enrollmentStatus} enrollment`
          : "Request cancellation (requires approval)"
      }
    >
      {isDirectCancel ? (
        <>
          <XCircle className="h-3.5 w-3.5 mr-1" />
          Cancel
        </>
      ) : (
        <>
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          Request
        </>
      )}
    </Link>
  );
}
