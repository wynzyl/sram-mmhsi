"use client";

import { useState } from "react";
import DirectCancelForm from "./DirectCancelForm";
import RequestCancellationForm from "./RequestCancellationForm";
import WithdrawRequestButton from "./WithdrawRequestButton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CANCELLATION_REASON_LABELS, type CancellationReason } from "@/lib/constants/cancellation-reasons";
import { AlertTriangle, Clock, XCircle } from "lucide-react";

export interface PendingCancellationRequest {
  id: string;
  reasonType: string;
  remarks: string | null;
  requestedAt: Date;
  requestedByName: string;
}

export interface EnrollmentCancellationSectionProps {
  enrollmentId: string;
  enrollmentStatus: string;
  studentName: string;
  gradeLevelName: string;
  assessmentTotalPaid?: number | null;
  pendingRequest?: PendingCancellationRequest | null;
  canCancel: boolean;
  canWithdraw: boolean;
}

/**
 * Section for enrollment cancellation actions.
 * - For pending/assessed: shows direct cancel button/form
 * - For enrolled: shows request cancellation button/form
 * - If pending request exists: shows request status + withdraw button
 */
export default function EnrollmentCancellationSection({
  enrollmentId,
  enrollmentStatus,
  studentName,
  gradeLevelName,
  assessmentTotalPaid,
  pendingRequest,
  canCancel,
  canWithdraw,
}: EnrollmentCancellationSectionProps) {
  const [showForm, setShowForm] = useState(false);

  // Don't show anything for cancelled enrollments
  if (enrollmentStatus === "cancelled") {
    return null;
  }

  // If there's a pending cancellation request, show its status
  if (pendingRequest) {
    const reasonLabel =
      CANCELLATION_REASON_LABELS[pendingRequest.reasonType as CancellationReason] ||
      pendingRequest.reasonType;

    return (
      <Card id="enrollment-cancellation-section" className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-600" />
              Pending Cancellation Request
            </CardTitle>
            <Badge variant="warning">Awaiting Review</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Reason: </span>
              <span className="font-medium">{reasonLabel}</span>
            </div>
            {pendingRequest.remarks && (
              <div>
                <span className="text-muted-foreground">Remarks: </span>
                <span>{pendingRequest.remarks}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground" suppressHydrationWarning>
              Requested by {pendingRequest.requestedByName} on{" "}
              {new Date(pendingRequest.requestedAt).toLocaleString("en-PH", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          <div className="rounded-md bg-amber-100/50 p-2.5 text-xs text-amber-800">
            <p className="font-medium">Transactions are blocked</p>
            <p className="mt-0.5 text-amber-700">
              Payments, voids, and discounts cannot be processed while this request is pending.
            </p>
          </div>

          {canWithdraw && (
            <div className="pt-2 border-t">
              <WithdrawRequestButton
                requestId={pendingRequest.id}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // For pending or assessed enrollments: direct cancellation
  if (enrollmentStatus === "pending" || enrollmentStatus === "assessed") {
    if (!canCancel) return null;

    if (showForm) {
      return (
        <Card id="enrollment-cancellation-section">
          <CardContent className="pt-6">
            <DirectCancelForm
              enrollmentId={enrollmentId}
              status={enrollmentStatus as "pending" | "assessed"}
              assessmentTotalPaid={assessmentTotalPaid}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card id="enrollment-cancellation-section">
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Cancel Enrollment</p>
              <p className="text-xs text-muted-foreground">
                Directly cancel this {enrollmentStatus} enrollment
              </p>
            </div>
          </div>
          <Button
            variant="danger-outline"
            size="sm"
            onClick={() => setShowForm(true)}
          >
            Cancel Enrollment
          </Button>
        </CardContent>
      </Card>
    );
  }

  // For enrolled enrollments: request cancellation (requires approval)
  if (enrollmentStatus === "enrolled") {
    if (!canCancel) return null;

    if (showForm) {
      return (
        <Card id="enrollment-cancellation-section">
          <CardContent className="pt-6">
            <RequestCancellationForm
              enrollmentId={enrollmentId}
              studentName={studentName}
              gradeLevelName={gradeLevelName}
            />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card id="enrollment-cancellation-section">
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <p className="text-sm font-medium">Request Cancellation</p>
              <p className="text-xs text-muted-foreground">
                Submit a cancellation request for administrator review
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowForm(true)}
          >
            Request Cancellation
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
