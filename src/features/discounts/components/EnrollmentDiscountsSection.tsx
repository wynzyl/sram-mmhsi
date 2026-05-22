"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  DiscountRequestView,
  DiscountTypeView,
} from "../discounts.schema";
import { cancelDiscountRequestAction } from "../discounts.actions";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFormToast } from "@/hooks/useFormToast";
import DiscountRequestForm from "./DiscountRequestForm";

interface EnrollmentDiscountsSectionProps {
  studentId: string;
  enrollmentId: string;
  enrollmentStatus: string;
  discountRequests: DiscountRequestView[];
  discountTypes: DiscountTypeView[];
  /** Whether the current user can request discounts */
  canRequest?: boolean;
  /**
   * When the request flow is blocked by the gate (e.g., reversed-discount lock),
   * this is the human-readable reason shown to the user in place of the button.
   */
  requestBlockReason?: string;
}

export default function EnrollmentDiscountsSection({
  studentId,
  enrollmentId,
  enrollmentStatus,
  discountRequests,
  discountTypes,
  canRequest = false,
  requestBlockReason,
}: EnrollmentDiscountsSectionProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Cancel discount request action state
  const [cancelState, cancelAction, isCancelling] = useActionState(
    cancelDiscountRequestAction,
    {}
  );
  useFormToast(cancelState, {
    successMessage: "Discount request cancelled.",
  });

  // Deep-link from a reversed-discount row uses
  //   ?requestDiscount=1&discountTypeCode=<code>
  // Auto-open the form pre-filled with that type, then strip the params so a
  // browser refresh doesn't re-open it.
  const requestDiscountParam = searchParams.get("requestDiscount");
  const discountTypeCodeParam = searchParams.get("discountTypeCode");
  const shouldAutoOpen =
    canRequest && requestDiscountParam === "1" && !!discountTypeCodeParam;

  const [showForm, setShowForm] = useState(shouldAutoOpen);
  const [prefillCode, setPrefillCode] = useState<string | undefined>(
    discountTypeCodeParam ?? undefined
  );

  // Strip the query params once they've been consumed so subsequent refreshes
  // don't keep re-opening the form. Guarded by a ref to run exactly once.
  const consumedRef = useRef(false);
  useEffect(() => {
    if (!shouldAutoOpen || consumedRef.current) return;
    consumedRef.current = true;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("requestDiscount");
    next.delete("discountTypeCode");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [shouldAutoOpen, searchParams, router, pathname]);

  const pendingRequests = discountRequests.filter(
    (r) => r.status === "pending"
  );
  const approvedRequests = discountRequests.filter(
    (r) => r.status === "approved"
  );
  const rejectedRequests = discountRequests.filter(
    (r) => r.status === "rejected"
  );

  const formatDiscountValue = (request: DiscountRequestView) => {
    const value = request.overrideValue ?? request.defaultValue;
    if (request.calculationType === "percentage") {
      return `${Number(value)}%`;
    }
    return <CurrencyDisplay amount={Number(value)} className="inline" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Discount Requests</CardTitle>
        {canRequest && !showForm && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
            Request Discount
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {requestBlockReason && !showForm && (
          <p className="text-xs text-[var(--color-text-muted)] italic">
            {requestBlockReason}
          </p>
        )}

        {/* Request Form */}
        {showForm && (
          <div className="p-4 border border-[var(--color-border)] rounded-lg">
            <h4 className="text-sm font-medium mb-3">New Discount Request</h4>
            <DiscountRequestForm
              studentId={studentId}
              enrollmentId={enrollmentId}
              discountTypes={discountTypes}
              initialDiscountTypeCode={prefillCode}
              initialRequestReason={
                prefillCode ? "Replacement for reversed discount." : undefined
              }
              onSuccess={() => {
                setShowForm(false);
                setPrefillCode(undefined);
              }}
              onCancel={() => {
                setShowForm(false);
                setPrefillCode(undefined);
              }}
            />
          </div>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-[var(--color-warning)] mb-2">
              Pending Approval ({pendingRequests.length})
            </h4>
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-3 bg-[var(--color-warning-100)] border border-[var(--color-warning)] rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{request.discountTypeName}</div>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        {formatDiscountValue(request)} -{" "}
                        {request.baseType === "tuition_only"
                          ? "Tuition Only"
                          : "Full Assessment"}
                      </div>
                      {request.requestReason && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          {request.requestReason}
                        </div>
                      )}
                    </div>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved Requests */}
        {approvedRequests.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-[var(--color-success)] mb-2">
              Approved ({approvedRequests.length})
            </h4>
            <div className="space-y-2">
              {approvedRequests.map((request) => {
                // Can cancel if: not applied to assessment AND enrollment is pending
                const canCancelApproved =
                  request.assessmentId === null && enrollmentStatus === "pending";

                return (
                  <div
                    key={request.id}
                    className="p-3 bg-[var(--color-accent-100)] border border-[var(--color-accent)] rounded-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{request.discountTypeName}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {formatDiscountValue(request)} -{" "}
                          {request.baseType === "tuition_only"
                            ? "Tuition Only"
                            : "Full Assessment"}
                        </div>
                        {request.overrideValue && request.overrideReason && (
                          <div className="text-xs text-[var(--color-text-muted)] mt-1">
                            Override: {request.overrideReason}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {canCancelApproved && (
                          <form action={cancelAction}>
                            <input
                              type="hidden"
                              name="discountRequestId"
                              value={request.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              disabled={isCancelling}
                              className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-100)]"
                            >
                              {isCancelling ? "Cancelling..." : "Cancel"}
                            </Button>
                          </form>
                        )}
                        <Badge variant="success">Approved</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rejected Requests */}
        {rejectedRequests.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              Rejected ({rejectedRequests.length})
            </h4>
            <div className="space-y-2">
              {rejectedRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-3 bg-[var(--color-surface-2)] rounded-lg opacity-60"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium line-through">
                        {request.discountTypeName}
                      </div>
                      {request.decisionRemarks && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          Reason: {request.decisionRemarks}
                        </div>
                      )}
                    </div>
                    <Badge variant="danger">Rejected</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {discountRequests.length === 0 && !showForm && (
          <div className="text-center py-4 text-[var(--color-text-muted)]">
            <p className="text-sm">No discount requests for this enrollment.</p>
            {canRequest && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(true)}
                className="mt-2"
              >
                Request a discount
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
