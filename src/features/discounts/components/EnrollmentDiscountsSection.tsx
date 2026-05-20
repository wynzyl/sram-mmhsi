"use client";

import { useState } from "react";
import type {
  DiscountRequestView,
  DiscountTypeView,
} from "../discounts.schema";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import DiscountRequestForm from "./DiscountRequestForm";

interface EnrollmentDiscountsSectionProps {
  studentId: string;
  enrollmentId: string;
  discountRequests: DiscountRequestView[];
  discountTypes: DiscountTypeView[];
  /** Whether the current user can request discounts */
  canRequest?: boolean;
}

export default function EnrollmentDiscountsSection({
  studentId,
  enrollmentId,
  discountRequests,
  discountTypes,
  canRequest = false,
}: EnrollmentDiscountsSectionProps) {
  const [showForm, setShowForm] = useState(false);

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
        {/* Request Form */}
        {showForm && (
          <div className="p-4 border border-[var(--color-border)] rounded-lg">
            <h4 className="text-sm font-medium mb-3">New Discount Request</h4>
            <DiscountRequestForm
              studentId={studentId}
              enrollmentId={enrollmentId}
              discountTypes={discountTypes}
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
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
              {approvedRequests.map((request) => (
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
                    <Badge variant="success">Approved</Badge>
                  </div>
                </div>
              ))}
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
