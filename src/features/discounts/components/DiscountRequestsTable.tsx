"use client";

import { useActionState, useState, useMemo } from "react";
import {
  approveDiscountRequestAction,
  rejectDiscountRequestAction,
  bulkApproveDiscountsAction,
  applyApprovedDiscountToExistingAssessment,
  cancelDiscountRequestAction,
} from "../discounts.actions";
import type {
  ApproveDiscountRequestFormState,
  RejectDiscountRequestFormState,
  BulkApproveDiscountsFormState,
  ApplyApprovedDiscountFormState,
  CancelDiscountRequestFormState,
  DiscountRequestView,
} from "../discounts.schema";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ColumnDef } from "@tanstack/react-table";

interface DiscountRequestsTableProps {
  requests: DiscountRequestView[];
  /** Enable bulk selection and approval */
  enableBulkActions?: boolean;
}

export default function DiscountRequestsTable({
  requests,
  enableBulkActions = true,
}: DiscountRequestsTableProps) {
  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // State for which request's forms are open
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState<string>("");

  // Form states
  const initialApproveState: ApproveDiscountRequestFormState = {};
  const [approveState, approveAction, approvePending] = useActionState(
    approveDiscountRequestAction,
    initialApproveState
  );

  const initialRejectState: RejectDiscountRequestFormState = {};
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectDiscountRequestAction,
    initialRejectState
  );

  const initialBulkState: BulkApproveDiscountsFormState = {};
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkApproveDiscountsAction,
    initialBulkState
  );

  const initialApplyState: ApplyApprovedDiscountFormState = {};
  const [applyState, applyAction, applyPending] = useActionState(
    applyApprovedDiscountToExistingAssessment,
    initialApplyState
  );

  const initialCancelState: CancelDiscountRequestFormState = {};
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelDiscountRequestAction,
    initialCancelState
  );

  useFormToast(approveState, {
    successMessage: "Discount request approved",
    onSuccess: () => {
      setApprovingId(null);
      setOverrideValue("");
    },
  });

  useFormToast(rejectState, {
    successMessage: "Discount request rejected",
    onSuccess: () => setRejectingId(null),
  });

  useFormToast(bulkState, {
    successMessage: `${selectedIds.size} discount request(s) approved`,
    onSuccess: () => setSelectedIds(new Set()),
  });

  useFormToast(applyState, {
    successMessage: "Discount applied to assessment",
  });

  useFormToast(cancelState, {
    successMessage: "Discount request cancelled",
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  };

  const formatDiscountValue = (request: DiscountRequestView) => {
    const value = request.overrideValue ?? request.defaultValue;
    if (request.calculationType === "percentage") {
      return `${Number(value)}%`;
    }
    return <CurrencyDisplay amount={Number(value)} />;
  };

  const columns = useMemo<ColumnDef<DiscountRequestView>[]>(
    () => [
      ...(enableBulkActions
        ? [
            {
              id: "select",
              header: () => (
                <input
                  type="checkbox"
                  checked={
                    requests.length > 0 && selectedIds.size === requests.length
                  }
                  onChange={toggleAll}
                  className="w-4 h-4"
                />
              ),
              cell: ({ row }: { row: { original: DiscountRequestView } }) => (
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.original.id)}
                  onChange={() => toggleSelection(row.original.id)}
                  className="w-4 h-4"
                />
              ),
              enableSorting: false,
              enableHiding: false,
            } as ColumnDef<DiscountRequestView>,
          ]
        : []),
      {
        header: "Student",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.studentName}</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              <ReferenceCode code={row.original.studentRef} />
            </div>
          </div>
        ),
      },
      {
        header: "Grade Level",
        accessorKey: "gradeLevelName",
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{row.original.gradeLevelName}</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {row.original.schoolYearLabel}
            </div>
          </div>
        ),
      },
      {
        header: "Discount Type",
        accessorKey: "discountTypeName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.discountTypeName}</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {row.original.baseType === "tuition_only"
                ? "Tuition Only"
                : "Full Assessment"}
            </div>
          </div>
        ),
      },
      {
        header: "Value",
        accessorKey: "defaultValue",
        cell: ({ row }) => (
          <div className="text-sm font-medium">
            {formatDiscountValue(row.original)}
          </div>
        ),
      },
      {
        header: "Discount Amount",
        accessorKey: "appliedDiscountAmount",
        cell: ({ row }) => (
          <div className="text-sm font-medium">
            {row.original.appliedDiscountAmount ? (
              <CurrencyDisplay amount={Number(row.original.appliedDiscountAmount)} />
            ) : (
              <span className="text-[var(--color-text-muted)]">-</span>
            )}
          </div>
        ),
      },
      {
        header: "Reason",
        accessorKey: "requestReason",
        cell: ({ row }) => (
          <span
            className="text-sm max-w-[150px] truncate block"
            title={row.original.requestReason ?? ""}
          >
            {row.original.requestReason || "-"}
          </span>
        ),
      },
      {
        header: "Requested",
        accessorKey: "requestedAt",
        cell: ({ row }) => {
          const date = new Date(row.original.requestedAt);
          return (
            <div className="text-sm">
              <div>{date.toLocaleDateString("en-PH")}</div>
              <div className="text-xs text-[var(--color-text-muted)]">
                by {row.original.requestedByName}
              </div>
            </div>
          );
        },
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const request = row.original;

          // Show reject form
          if (rejectingId === request.id) {
            return (
              <form action={rejectAction} className="flex flex-col gap-2">
                <input
                  type="hidden"
                  name="discountRequestId"
                  value={request.id}
                />
                <Input
                  type="text"
                  name="decisionRemarks"
                  placeholder="Rejection reason"
                  required
                  className="w-40 h-8 text-xs"
                />
                <div className="flex gap-1">
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    loading={rejectPending}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejectingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            );
          }

          // Show approve form with optional override
          if (approvingId === request.id) {
            return (
              <form action={approveAction} className="flex flex-col gap-2">
                <input
                  type="hidden"
                  name="discountRequestId"
                  value={request.id}
                />
                <div className="flex gap-1 items-center">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Override:
                  </span>
                  <Input
                    type="number"
                    name="overrideValue"
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    placeholder={String(request.defaultValue)}
                    className="w-20 h-7 text-xs"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    type="submit"
                    variant="success"
                    size="sm"
                    loading={approvePending}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setApprovingId(null);
                      setOverrideValue("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            );
          }

          // Approved-but-unapplied row: show actions based on state
          if (request.status === "approved" && !request.assessmentId) {
            // Case 1: Enrollment has assessment - show "Apply to Assessment"
            // Case 2: Enrollment is pending (no assessment) - show "Cancel" if canCancel
            return (
              <div className="flex gap-2">
                {/* Apply button when enrollment has an active assessment */}
                {request.enrollmentHasAssessment && (
                  <form action={applyAction}>
                    <input
                      type="hidden"
                      name="discountRequestId"
                      value={request.id}
                    />
                    <Button
                      type="submit"
                      variant="success"
                      size="sm"
                      loading={applyPending}
                    >
                      Apply
                    </Button>
                  </form>
                )}
                {/* Cancel button when discount is cancellable (approved, not applied, enrollment pending) */}
                {request.canCancel && (
                  <form action={cancelAction}>
                    <input
                      type="hidden"
                      name="discountRequestId"
                      value={request.id}
                    />
                    <Button
                      type="submit"
                      variant="danger"
                      size="sm"
                      loading={cancelPending}
                    >
                      Cancel
                    </Button>
                  </form>
                )}
              </div>
            );
          }

          // Pending row: default approve/reject buttons.
          if (request.status === "pending") {
            return (
              <div className="flex gap-2">
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => setApprovingId(request.id)}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setRejectingId(request.id)}
                >
                  Reject
                </Button>
              </div>
            );
          }

          // Terminal states (rejected, cancelled, reversed, applied) — read-only.
          return (
            <span className="text-xs text-[var(--color-text-muted)]">
              {request.status === "approved" && request.assessmentId
                ? "Applied"
                : request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          );
        },
      },
    ],
    [
      enableBulkActions,
      selectedIds,
      requests,
      rejectingId,
      approvingId,
      overrideValue,
      approveAction,
      approvePending,
      rejectAction,
      rejectPending,
      applyAction,
      applyPending,
      cancelAction,
      cancelPending,
    ]
  );

  if (requests.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-[var(--color-text-muted)] mb-2">
          No pending discount requests
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Discount requests from registrars will appear here for review.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk actions bar */}
      {enableBulkActions && selectedIds.size > 0 && (
        <div className="mx-4 mt-4 p-3 bg-[var(--color-surface-2)] rounded-lg flex items-center justify-between">
          <span className="text-sm">
            {selectedIds.size} request{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <form action={bulkAction}>
            {Array.from(selectedIds).map((id) => (
              <input
                key={id}
                type="hidden"
                name="discountRequestIds"
                value={id}
              />
            ))}
            <Button
              type="submit"
              variant="success"
              size="sm"
              loading={bulkPending}
            >
              Approve Selected
            </Button>
          </form>
        </div>
      )}

      <DataTable columns={columns} data={requests} searchable={false} />
    </div>
  );
}
