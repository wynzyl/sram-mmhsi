"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DocumentRequestDetail } from "@/features/documents/document-requests.queries";
import {
  ProcessDocumentRequestForm,
  ReadyDocumentRequestForm,
  ReleaseDocumentRequestForm,
  RejectDocumentRequestForm,
  CancelDocumentRequestForm,
  PrintDocumentButton,
  DownloadDocumentButton,
} from "@/features/documents/components/DocumentRequestStatusActions";
import {
  canProgressRequest,
  canCancelRequest,
} from "@/lib/constants/document-requests";

interface DocumentRequestDetailActionsProps {
  request: DocumentRequestDetail;
  canProcess: boolean;
  canRelease: boolean;
  releaseEligibility: {
    canRelease: boolean;
    reason?: string;
  };
  processingEligibility: {
    canProcess: boolean;
    reason?: string;
  };
  /** Whether the student has outstanding balance (blocks print/download) */
  hasOutstandingBalance: boolean;
  /** Message explaining why print/download is blocked */
  balanceBlockReason?: string;
}

export function DocumentRequestDetailActions({
  request,
  canProcess,
  canRelease,
  releaseEligibility,
  processingEligibility,
  hasOutstandingBalance,
  balanceBlockReason,
}: DocumentRequestDetailActionsProps) {
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // Terminal states - only show print/download
  if (request.status === "released") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PrintDocumentButton
            requestId={request.id}
            documentNumber={request.documentNumber}
            disabled={hasOutstandingBalance}
            disabledReason={balanceBlockReason}
          />
          <DownloadDocumentButton
            requestId={request.id}
            documentNumber={request.documentNumber}
            disabled={hasOutstandingBalance}
            disabledReason={balanceBlockReason}
          />
        </CardContent>
      </Card>
    );
  }

  if (request.status === "rejected" || request.status === "cancelled") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This request has been {request.status}. No further actions available.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Active workflow states
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Process Action (requested → processing) */}
        {request.status === "requested" && canProcess && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Start Processing</h4>
            <ProcessDocumentRequestForm
              request={request}
              canProcess={processingEligibility.canProcess}
              processBlockReason={processingEligibility.reason}
            />
          </div>
        )}

        {/* Ready Action (processing → ready) */}
        {request.status === "processing" && canProcess && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Mark as Ready</h4>
            <ReadyDocumentRequestForm request={request} />
          </div>
        )}

        {/* Release Action (ready → released) */}
        {request.status === "ready" && canRelease && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Release Document</h4>
            <ReleaseDocumentRequestForm
              request={request}
              canRelease={releaseEligibility.canRelease}
              releaseBlockReason={releaseEligibility.reason}
            />
          </div>
        )}

        {/* Print/Download for ready documents */}
        {request.status === "ready" && request.documentNumber && (() => {
          // Preview/download is blocked by the full release-eligibility check
          // (outstanding balance AND pending clearances), not balance alone.
          const previewDisabled =
            hasOutstandingBalance || !releaseEligibility.canRelease;
          const previewDisabledReason = hasOutstandingBalance
            ? balanceBlockReason
            : releaseEligibility.reason;

          return (
            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-medium">Preview Document</h4>
              <div className="flex flex-col gap-2">
                <PrintDocumentButton
                  requestId={request.id}
                  documentNumber={request.documentNumber}
                  variant="secondary"
                  disabled={previewDisabled}
                  disabledReason={previewDisabledReason}
                />
                <DownloadDocumentButton
                  requestId={request.id}
                  documentNumber={request.documentNumber}
                  disabled={previewDisabled}
                  disabledReason={previewDisabledReason}
                />
              </div>
            </div>
          );
        })()}

        {/* Secondary Actions */}
        {canProcess && canProgressRequest(request.status) && (
          <div className="border-t pt-4">
            {/* Reject Action */}
            {!showReject ? (
              <Button
                variant="danger-outline"
                size="sm"
                className="w-full"
                onClick={() => setShowReject(true)}
              >
                Reject Request
              </Button>
            ) : (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-destructive">
                    Reject Request
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReject(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <RejectDocumentRequestForm
                  request={request}
                  onSuccess={() => setShowReject(false)}
                />
              </div>
            )}

            {/* Cancel Action */}
            {canCancelRequest(request.status) && (
              <div className="mt-2">
                {!showCancel ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCancel(true)}
                  >
                    Cancel Request
                  </Button>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium">Cancel Request</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCancel(false)}
                      >
                        Back
                      </Button>
                    </div>
                    <CancelDocumentRequestForm
                      request={request}
                      onSuccess={() => setShowCancel(false)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
