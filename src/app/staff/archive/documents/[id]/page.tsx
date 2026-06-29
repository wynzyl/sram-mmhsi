import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDateTime } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getDocumentRequestById,
  checkDocumentReleaseEligibility,
  checkDocumentProcessingEligibility,
  getStudentOutstandingBalance,
} from "@/features/documents/document-requests.queries";
import {
  DOCUMENT_REQUEST_TYPE_LABELS,
  DOCUMENT_REQUEST_STATUS_LABELS,
} from "@/lib/constants/document-requests";
import { DocumentRequestDetailActions } from "./DocumentRequestDetailActions";

export const metadata: Metadata = {
  title: "Document Request Details",
  description: "View and manage document request details.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentRequestDetailPage({ params }: PageProps) {
  // Force dynamic rendering - document requests are transactional data
  await connection();

  const session = await requireSession();

  if (!hasPermission(session.role, "documents:read")) {
    redirect("/staff/dashboard");
  }

  const { id } = await params;
  const request = await getDocumentRequestById(id);

  if (!request) {
    notFound();
  }

  // Parallelize eligibility checks - all depend on studentId which we now have
  const [releaseEligibilityResult, processingEligibilityResult, outstandingBalance] =
    await Promise.all([
      // Check release eligibility if the document is ready
      request.status === "ready"
        ? checkDocumentReleaseEligibility(request.studentId)
        : Promise.resolve({ canRelease: false } as const),
      // Check processing eligibility if the document is in requested status
      request.status === "requested"
        ? checkDocumentProcessingEligibility(request.studentId)
        : Promise.resolve({ canProcess: true } as const),
      // Always check student balance (for print/download restriction)
      getStudentOutstandingBalance(request.studentId),
    ]);

  // Transform results
  const releaseEligibility: { canRelease: boolean; reason?: string } =
    releaseEligibilityResult.canRelease
      ? { canRelease: true }
      : { canRelease: false, reason: "reason" in releaseEligibilityResult ? releaseEligibilityResult.reason : undefined };

  const processingEligibility: { canProcess: boolean; reason?: string } =
    processingEligibilityResult.canProcess
      ? { canProcess: true }
      : { canProcess: false, reason: "reason" in processingEligibilityResult ? processingEligibilityResult.reason : undefined };

  const hasOutstandingBalance = outstandingBalance > 0.01;
  const balanceBlockReason = hasOutstandingBalance
    ? `Student has an outstanding balance of ${formatCurrency(outstandingBalance)}. Print/download is disabled until balance is settled.`
    : undefined;

  const canProcess = hasPermission(session.role, "documents:process");
  const canRelease = hasPermission(session.role, "documents:release");

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/staff/archive" className="hover:text-primary">
          Archive
        </Link>
        <span className="mx-2">/</span>
        <Link href="/staff/archive/documents" className="hover:text-primary">
          Document Requests
        </Link>
        <span className="mx-2">/</span>
        <span>{request.documentNumber ?? request.id.slice(0, 8)}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {DOCUMENT_REQUEST_TYPE_LABELS[request.documentType]}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={request.status} type="documentRequest" />
            {request.documentNumber && (
              <span className="font-mono text-sm text-muted-foreground">
                {request.documentNumber}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Student Information */}
          <Card>
            <CardHeader>
              <CardTitle>Student Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Name
                </p>
                <p className="font-medium">{request.studentName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Reference Number
                </p>
                <p className="font-mono">{request.studentRef}</p>
              </div>
              {request.schoolYearLabel && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    School Year
                  </p>
                  <p>{request.schoolYearLabel}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Student Profile
                </p>
                <Link
                  href={`/staff/archive/${request.studentId}`}
                  className="text-primary hover:underline"
                >
                  View Profile
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Document Type
                </p>
                <p>{DOCUMENT_REQUEST_TYPE_LABELS[request.documentType]}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Copies
                </p>
                <p>{request.copies}</p>
              </div>
              {request.purpose && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Purpose
                  </p>
                  <p>{request.purpose}</p>
                </div>
              )}
              {request.feeAmount && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Fee Amount
                  </p>
                  <p className="font-medium">
                    <CurrencyDisplay amount={Number(request.feeAmount)} />
                  </p>
                </div>
              )}
              {request.remarks && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Remarks
                  </p>
                  <p className="text-sm">{request.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Requested */}
                <TimelineItem
                  label="Requested"
                  timestamp={request.requestedAt}
                  user={request.requestedByName}
                  completed
                />

                {/* Processing */}
                <TimelineItem
                  label="Processing"
                  timestamp={request.processedAt}
                  user={request.processedByName}
                  completed={
                    request.status !== "requested" &&
                    request.status !== "rejected" &&
                    request.status !== "cancelled"
                  }
                />

                {/* Ready */}
                {request.status !== "rejected" &&
                  request.status !== "cancelled" && (
                    <TimelineItem
                      label="Ready for Release"
                      completed={
                        request.status === "ready" ||
                        request.status === "released"
                      }
                    />
                  )}

                {/* Released */}
                {request.status !== "rejected" &&
                  request.status !== "cancelled" && (
                    <TimelineItem
                      label="Released"
                      timestamp={request.releasedAt}
                      user={request.releasedByName}
                      completed={request.status === "released"}
                    />
                  )}

                {/* Rejected (if applicable) */}
                {request.status === "rejected" && (
                  <TimelineItem
                    label="Rejected"
                    timestamp={request.processedAt}
                    user={request.processedByName}
                    completed
                    variant="destructive"
                  />
                )}

                {/* Cancelled (if applicable) */}
                {request.status === "cancelled" && (
                  <TimelineItem
                    label="Cancelled"
                    completed
                    variant="muted"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Rejection Reason (if rejected) */}
          {request.status === "rejected" && request.rejectedReason && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">
                  Rejection Reason
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{request.rejectedReason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <StatusBadge status={request.status} type="documentRequest" />
                <span className="text-sm text-muted-foreground">
                  {DOCUMENT_REQUEST_STATUS_LABELS[request.status]}
                </span>
              </div>
              {request.documentNumber && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Document Number
                  </p>
                  <p className="font-mono text-lg">{request.documentNumber}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions Card */}
          <DocumentRequestDetailActions
            request={request}
            canProcess={canProcess}
            canRelease={canRelease}
            releaseEligibility={releaseEligibility}
            processingEligibility={processingEligibility}
            hasOutstandingBalance={hasOutstandingBalance}
            balanceBlockReason={balanceBlockReason}
          />
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  timestamp,
  user,
  completed,
  variant = "default",
}: {
  label: string;
  timestamp?: Date | null;
  user?: string | null;
  completed?: boolean;
  variant?: "default" | "destructive" | "muted";
}) {
  const dotColor = {
    default: completed ? "bg-green-500" : "bg-muted",
    destructive: "bg-destructive",
    muted: "bg-muted-foreground",
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`h-3 w-3 rounded-full ${dotColor[variant]}`}
        />
        <div className="h-full w-px bg-border" />
      </div>
      <div className="pb-4">
        <p
          className={`font-medium ${
            completed ? "" : "text-muted-foreground"
          }`}
        >
          {label}
        </p>
        {timestamp && (
          <p className="text-sm text-muted-foreground">
            {formatDateTime(timestamp)}
          </p>
        )}
        {user && (
          <p className="text-sm text-muted-foreground">by {user}</p>
        )}
      </div>
    </div>
  );
}
