"use client";

import Link from "next/link";
import type { StudentClearanceSummary } from "../clearances.queries";
import { CLEARANCE_TYPE_LABELS, type ClearanceType } from "../clearances.schema";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { AlertTriangle, FileText } from "lucide-react";

interface StudentClearanceCardProps {
  summary: StudentClearanceSummary;
  studentId: string;
}

export default function StudentClearanceCard({
  summary,
  studentId,
}: StudentClearanceCardProps) {
  const hasPending = summary.pendingCount > 0;

  return (
    <Card className={cn(
      hasPending && "border-warning/25 bg-warning/10"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Clearances
          </CardTitle>
          {hasPending && (
            <div className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">
                {summary.pendingCount} pending
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {summary.totalClearances === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clearance records found.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-success/10 p-2">
                <p className="text-lg font-semibold text-success">
                  {summary.clearedCount}
                </p>
                <p className="text-xs text-success">Cleared</p>
              </div>
              <div className="rounded-md bg-warning-tint p-2">
                <p className="text-lg font-semibold text-warning">
                  {summary.pendingCount}
                </p>
                <p className="text-xs text-warning">Pending</p>
              </div>
              <div className="rounded-md bg-info-tint p-2">
                <p className="text-lg font-semibold text-info">
                  {summary.waivedCount}
                </p>
                <p className="text-xs text-info">Waived</p>
              </div>
            </div>

            {/* Outstanding Amount */}
            {summary.totalOutstanding > 0 && (
              <div className="rounded-md border border-warning/25 bg-warning/10 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-warning">
                  Total Outstanding
                </p>
                <p className="mt-1 text-xl font-bold text-warning">
                  <CurrencyDisplay amount={summary.totalOutstanding} />
                </p>
                <p className="mt-1 text-xs text-warning">
                  Document release blocked until cleared
                </p>
              </div>
            )}

            {/* Recent Clearances */}
            {summary.clearances.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recent Clearances
                </p>
                <div className="divide-y rounded-md border">
                  {summary.clearances.slice(0, 3).map((clearance) => (
                    <div
                      key={clearance.id}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {CLEARANCE_TYPE_LABELS[clearance.clearanceType as ClearanceType]}
                        </p>
                        {clearance.schoolYearLabel && (
                          <p className="text-xs text-muted-foreground">
                            {clearance.schoolYearLabel}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <CurrencyDisplay
                          amount={Number(clearance.outstandingAmount)}
                          className="text-sm"
                        />
                        <StatusBadge type="clearance" status={clearance.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View All Link */}
            <Link href={`/staff/students/${studentId}/clearances`}>
              <Button variant="secondary" size="sm" className="w-full">
                View All Clearances
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
