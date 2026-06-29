"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils/date";
import { DOCUMENT_REQUEST_TYPE_LABELS } from "@/lib/constants/document-requests";
import { CreateDocumentRequestDialog } from "@/features/documents/components/CreateDocumentRequestDialog";
import type { StudentDocumentSummary } from "@/features/documents/document-requests.queries";

interface ArchivedStudentDocumentRequestsProps {
  studentId: string;
  studentName: string;
  documentRequests: StudentDocumentSummary;
  schoolYearOptions: Array<{ id: string; label: string }>;
  canCreateRequest: boolean;
}

export function ArchivedStudentDocumentRequests({
  studentId,
  studentName,
  documentRequests,
  schoolYearOptions,
  canCreateRequest,
}: ArchivedStudentDocumentRequestsProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Document Requests</CardTitle>
            {documentRequests.pendingRequests > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {documentRequests.pendingRequests} pending request
                {documentRequests.pendingRequests > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {canCreateRequest && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                Request Document
              </Button>
            )}
            <Link
              href={`/staff/archive/documents?studentId=${studentId}`}
              prefetch={false}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {documentRequests.requests.length === 0 ? (
            <p className="text-muted-foreground">
              No document requests found for this student.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted">
                    <th className="p-2 text-left font-medium">Document Type</th>
                    <th className="p-2 text-left font-medium">Doc Number</th>
                    <th className="p-2 text-left font-medium">Requested</th>
                    <th className="p-2 text-left font-medium">Status</th>
                    <th className="p-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documentRequests.requests.slice(0, 5).map((request) => (
                    <tr key={request.id} className="border-b">
                      <td className="p-2">
                        {DOCUMENT_REQUEST_TYPE_LABELS[request.documentType]}
                      </td>
                      <td className="p-2 font-mono">
                        {request.documentNumber ?? "—"}
                      </td>
                      <td className="p-2">{formatDate(request.requestedAt)}</td>
                      <td className="p-2">
                        <StatusBadge
                          status={request.status}
                          type="documentRequest"
                        />
                      </td>
                      <td className="p-2">
                        <Link
                          href={`/staff/archive/documents/${request.id}`}
                          prefetch={false}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {documentRequests.totalRequests > 5 && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Showing 5 of {documentRequests.totalRequests} requests.{" "}
                  <Link
                    href={`/staff/archive/documents?studentId=${studentId}`}
                    prefetch={false}
                    className="text-primary hover:underline"
                  >
                    View all
                  </Link>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Document Request Dialog */}
      {showCreateDialog && (
        <CreateDocumentRequestDialog
          studentId={studentId}
          studentName={studentName}
          schoolYearOptions={schoolYearOptions}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </>
  );
}
