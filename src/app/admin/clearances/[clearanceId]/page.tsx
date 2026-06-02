import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getClearanceById } from "@/features/clearances/clearances.queries";
import ResolveClearanceForm from "@/features/clearances/components/ResolveClearanceForm";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { formatDate } from "@/lib/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  CLEARANCE_TYPE_LABELS,
  RESOLUTION_TYPE_LABELS,
  type ClearanceType,
  type ResolutionType,
} from "@/features/clearances/clearances.schema";
import { ArrowLeft, CheckCircle, Clock, User, Calendar, FileText } from "lucide-react";

export const metadata: Metadata = { title: "Clearance Details" };

interface PageProps {
  params: Promise<{ clearanceId: string }>;
}

export default async function ClearanceDetailPage({ params }: PageProps) {
  const session = await requireSession();

  if (!hasPermission(session.role, "clearances:read")) {
    redirect("/admin/clearances");
  }

  const { clearanceId } = await params;

  const clearance = await getClearanceById(clearanceId);

  if (!clearance) {
    notFound();
  }

  const isPending = clearance.status === "pending";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Link href="/admin/clearances">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        </Link>
      </header>

      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Clearance Record</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {CLEARANCE_TYPE_LABELS[clearance.clearanceType as ClearanceType]}
              </p>
            </div>
            <StatusBadge type="clearance" status={clearance.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Student
              </p>
              <p className="mt-1 text-sm font-medium">{clearance.studentName}</p>
              <p className="text-xs text-muted-foreground">
                <ReferenceCode code={clearance.studentRef} />
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                School Year
              </p>
              <p className="mt-1 text-sm font-medium">
                {clearance.schoolYearLabel || "N/A"}
              </p>
            </div>
          </div>

          {/* Outstanding Amount */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Outstanding Amount (at creation)
                  </p>
                  <p className="mt-1 text-2xl font-bold text-amber-600">
                    <CurrencyDisplay amount={Number(clearance.outstandingAmount)} />
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Created
                </p>
                <p className="mt-1 text-sm">
                  {formatDate(clearance.createdAt, { year: "numeric", month: "numeric", day: "numeric" })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resolution Form (for pending) or Resolution Details */}
      {isPending ? (
        <div className="max-w-md">
          <ResolveClearanceForm
            clearanceId={clearance.id}
            outstandingAmount={Number(clearance.outstandingAmount)}
          />
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resolution Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Resolution Type
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {clearance.resolutionType
                      ? RESOLUTION_TYPE_LABELS[clearance.resolutionType as ResolutionType]
                      : "Cleared (no balance)"}
                  </p>
                </div>
              </div>
              {clearance.resolvedAt && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Resolved At
                    </p>
                    <p className="mt-1 text-sm">
                      {formatDate(clearance.resolvedAt, {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              )}
              {clearance.resolvedByName && (
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Resolved By
                    </p>
                    <p className="mt-1 text-sm">{clearance.resolvedByName}</p>
                  </div>
                </div>
              )}
            </div>
            {clearance.resolutionRemarks && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Resolution Remarks
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {clearance.resolutionRemarks}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
