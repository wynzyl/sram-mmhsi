"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { financialFreshness } from "@/lib/query/staleness";
import { updateEnrollmentStatusAction } from "@/features/enrollments/enrollments.actions";
import type { AssessmentListItem, AssessmentTabCounts, PendingAssessmentQueueRow } from "../assessments.queries";

export type AssessmentView =
  | "pending"
  | "unpaid"
  | "outstanding"
  | "paid"
  | "cancelled"
  | "forwarded";

export type AssessmentsDirectoryResponse = {
  view: AssessmentView;
  // billing rows; transferredAt is serialized to string over JSON (unused by table)
  rows: (Omit<AssessmentListItem, "transferredAt"> & { transferredAt: string | null })[];
  pendingRows: PendingAssessmentQueueRow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  tabCounts: AssessmentTabCounts;
  pendingCount: number;
  canCreate: boolean;
  canCancel: boolean;
};

export type AssessmentFilters = {
  view: AssessmentView;
  page: number;
};

async function fetchAssessments(
  filters: AssessmentFilters
): Promise<AssessmentsDirectoryResponse> {
  const params = new URLSearchParams();
  params.set("view", filters.view);
  if (filters.page > 1) params.set("page", String(filters.page));

  const res = await fetch(`/api/assessments?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch assessments: ${res.status}`);
  }
  return res.json();
}

/**
 * Assessments directory list (always-fresh financial data).
 * Each {view, page} combo is its own cache entry; keepPreviousData smooths
 * tab/page switches.
 */
export function useAssessments(filters: AssessmentFilters) {
  return useQuery({
    queryKey: queryKeys.assessments.list(filters),
    queryFn: () => fetchAssessments(filters),
    placeholderData: keepPreviousData,
    ...financialFreshness(),
  });
}

/**
 * Cancel a pending enrollment from the fee-assessment queue.
 * Invalidates the assessments lists and the cashier queue so balances/counts
 * refresh live.
 */
export function useCancelAssessmentFromQueue() {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof updateEnrollmentStatusAction>>,
    Error,
    FormData
  >({
    mutationFn: (formData) => updateEnrollmentStatusAction({}, formData),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.queue() });
      }
    },
  });
}
