"use client";

import { useState, useActionState } from "react";
import type { CancellationRequestDetail as CancellationRequestDetailType } from "../enrollment-cancellation.queries";
import {
  approveEnrollmentCancellationAction,
  rejectEnrollmentCancellationAction,
} from "../enrollment-cancellation.actions";
import { CANCELLATION_REASON_LABELS, type CancellationReason } from "@/lib/constants/cancellation-reasons";
import { useFormToast } from "@/hooks/useFormToast";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TextAreaField } from "@/components/forms/TextInputField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  FileText,
} from "lucide-react";

interface CancellationRequestDetailProps {
  request: CancellationRequestDetailType;
  currentUserId: string;
  onActionComplete?: () => void;
}

const STATUS_VARIANT_MAP: Record<string, "warning" | "success" | "danger" | "secondary"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "secondary",
};

export default function CancellationRequestDetailView({
  request,
  currentUserId,
  onActionComplete,
}: CancellationRequestDetailProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reviewRemarks, setReviewRemarks] = useState("");

  const [approveState, approveAction, approvePending] = useActionState(
    approveEnrollmentCancellationAction,
    {}
  );

  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectEnrollmentCancellationAction,
    {}
  );

  useFormToast(approveState, {
    successMessage: "Cancellation request approved. Enrollment has been cancelled.",
    onSuccess: onActionComplete,
  });

  useFormToast(rejectState, {
    successMessage: "Cancellation request rejected.",
    onSuccess: () => {
      setShowRejectForm(false);
      onActionComplete?.();
    },
  });

  const isSelfRequest = request.requestedByName === currentUserId;
  const isPending = request.status === "pending";

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Cancellation Request</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Review and process this enrollment cancellation request
              </p>
            </div>
            <Badge variant={STATUS_VARIANT_MAP[request.status] || "secondary"}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Student
              </p>
              <p className="mt-1 text-sm font-medium">{request.studentName}</p>
              <p className="text-xs text-muted-foreground">
                <ReferenceCode code={request.studentRef} />
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Grade Level / School Year
              </p>
              <p className="mt-1 text-sm font-medium">{request.gradeLevelName}</p>
              <p className="text-xs text-muted-foreground">{request.schoolYearLabel}</p>
            </div>
          </div>

          {/* Request Details */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reason
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {CANCELLATION_REASON_LABELS[request.reasonType as CancellationReason]}
                  </p>
                  {request.remarks && (
                    <p className="mt-1 text-sm text-muted-foreground">{request.remarks}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Requested By
                  </p>
                  <p className="mt-1 text-sm font-medium">{request.requestedByName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Clock className="mr-1 inline-block h-3 w-3" />
                    {new Date(request.requestedAt).toLocaleString("en-PH")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Info (if exists) */}
      {request.assessment && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assessment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Amount
                </p>
                <p className="mt-1 text-lg font-semibold">
                  <CurrencyDisplay amount={Number(request.assessment.totalAmount)} />
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Paid
                </p>
                <p className="mt-1 text-lg font-semibold text-green-600">
                  <CurrencyDisplay amount={Number(request.assessment.totalPaid)} />
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Balance
                </p>
                <p className="mt-1 text-lg font-semibold text-amber-600">
                  <CurrencyDisplay amount={Number(request.assessment.balance)} />
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <p className="mt-1">
                  <StatusBadge status={request.assessment.billingStatus} type="billing" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refund Preview (if applicable) */}
      {request.refundPreview && Number(request.assessment?.totalPaid || 0) > 0 && (
        <Card className={cn(
          "border-2",
          request.refundPreview.isEligibleForRefund
            ? "border-green-200 bg-green-50/30"
            : "border-amber-200 bg-amber-50/30"
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {request.refundPreview.isEligibleForRefund ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">Eligible for Partial Refund</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span className="text-amber-700">Past Refund Cutoff</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Cutoff Date:{" "}
                <span className="font-medium text-foreground">
                  {new Date(request.refundPreview.cutoffDate).toLocaleDateString("en-PH", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Paid
                </p>
                <p className="mt-1 text-lg font-semibold">
                  <CurrencyDisplay amount={request.refundPreview.totalPaid} />
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {request.refundPreview.isEligibleForRefund ? "To be Refunded" : "Forfeited"}
                </p>
                <p className={cn(
                  "mt-1 text-lg font-semibold",
                  request.refundPreview.isEligibleForRefund ? "text-green-600" : "text-amber-600"
                )}>
                  <CurrencyDisplay amount={request.refundPreview.isEligibleForRefund ? request.refundPreview.refundableAmount : request.refundPreview.nonRefundableAmount} />
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Non-Refundable (Kept)
                </p>
                <p className="mt-1 text-lg font-semibold">
                  <CurrencyDisplay amount={request.refundPreview.nonRefundableAmount} />
                </p>
              </div>
            </div>

            {request.refundPreview.itemBreakdown.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Item Breakdown
                </p>
                <div className="divide-y rounded-md border bg-white">
                  {request.refundPreview.itemBreakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          item.isRefundable ? "bg-green-500" : "bg-gray-400"
                        )} />
                        <span>{item.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CurrencyDisplay amount={item.paidAmount} />
                        {request.refundPreview!.isEligibleForRefund && (
                          <span className={cn(
                            "text-xs",
                            item.willRefund ? "text-green-600" : "text-muted-foreground"
                          )}>
                            {item.willRefund ? "Refund" : "Keep"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review Actions (only for pending) */}
      {isPending && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Review Decision</CardTitle>
          </CardHeader>
          <CardContent>
            {isSelfRequest ? (
              <p className="text-sm text-muted-foreground italic">
                You cannot approve or reject your own request. Another administrator must review this request.
              </p>
            ) : showRejectForm ? (
              <form action={rejectAction} className="space-y-4">
                <input type="hidden" name="requestId" value={request.id} />

                <TextAreaField
                  label="Rejection Reason (required)"
                  name="reviewRemarks"
                  required
                  value={reviewRemarks}
                  onChange={setReviewRemarks}
                  error={rejectState.errors?.reviewRemarks}
                  rows={3}
                  placeholder="Please provide a reason for rejecting this request (minimum 10 characters)..."
                />

                {rejectState.message && !rejectState.success && (
                  <p className="text-xs text-destructive">{rejectState.message}</p>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={rejectPending}
                  >
                    {rejectPending ? "Rejecting..." : "Confirm Rejection"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRejectForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <form action={approveAction}>
                  <input type="hidden" name="requestId" value={request.id} />

                  <div className="mb-4">
                    <TextAreaField
                      label="Review remarks (optional)"
                      name="reviewRemarks"
                      value={reviewRemarks}
                      onChange={setReviewRemarks}
                      error={approveState.errors?.reviewRemarks}
                      rows={2}
                      placeholder="Any notes about this approval..."
                    />
                  </div>

                  {approveState.message && !approveState.success && (
                    <p className="mb-4 text-xs text-destructive">{approveState.message}</p>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      variant="success"
                      disabled={approvePending}
                    >
                      <CheckCircle className="h-4 w-4" />
                      {approvePending ? "Approving..." : "Approve Cancellation"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger-outline"
                      onClick={() => setShowRejectForm(true)}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject Request
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review Result (for processed requests) */}
      {!isPending && request.reviewedAt && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Review Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reviewed At
                  </p>
                  <p className="mt-1 text-sm">
                    {new Date(request.reviewedAt).toLocaleString("en-PH")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reviewed By
                  </p>
                  <p className="mt-1 text-sm">{request.reviewedByName}</p>
                </div>
              </div>
            </div>
            {request.reviewRemarks && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Review Remarks
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{request.reviewRemarks}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
