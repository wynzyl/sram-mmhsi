"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { queryKeys } from "@/lib/query/keys";
import { LIVE_DATA_STALE_TIME } from "@/lib/query/staleness";
import { postPaymentAction } from "../payments.actions";
import { voidPaymentAction } from "../actions/void-payment.actions";
import type {
  PaymentFormState,
  VoidPaymentFormState,
} from "../payments.schema";
import type { CashierQueueRow, CashierStats, RecentCollection } from "../payments.queries";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type CashierQueueResponse = {
  queue: CashierQueueRow[];
  stats: CashierStats;
  recentCollections: Array<Omit<RecentCollection, "paymentDate"> & { paymentDate: string }>;
};

// ─────────────────────────────────────────────────────────────────
// Response Validation Schema
// ─────────────────────────────────────────────────────────────────

const CashierQueueRowSchema = z.object({
  assessmentId: z.string(),
  studentName: z.string(),
  referenceNumber: z.string(),
  gradeLevel: z.string(),
  schoolYear: z.string(),
  billingStatus: z.string(),
  balance: z.number(),
  totalPaid: z.number(),
});

const CashierStatsSchema = z.object({
  totalCollectedToday: z.number(),
  pendingPaymentsCount: z.number(),
  studentsAssessed: z.number(),
  totalCollectibles: z.number(),
});

const RecentCollectionSchema = z.object({
  paymentId: z.string(),
  orNumber: z.string().nullable(),
  amount: z.number(),
  paymentDate: z.string(), // Serialized Date from API
  studentFirstName: z.string(),
  studentLastName: z.string(),
  assessmentId: z.string().nullable(),
});

const CashierQueueResponseSchema = z.object({
  queue: z.array(CashierQueueRowSchema),
  stats: CashierStatsSchema,
  recentCollections: z.array(RecentCollectionSchema),
});

// ─────────────────────────────────────────────────────────────────
// Fetch Function
// ─────────────────────────────────────────────────────────────────

async function fetchCashierQueue(): Promise<CashierQueueResponse> {
  const res = await fetch("/api/cashier/queue");

  if (!res.ok) {
    throw new Error(`Failed to fetch cashier queue: ${res.status}`);
  }

  const json = await res.json();
  const parsed = CashierQueueResponseSchema.safeParse(json);

  if (!parsed.success) {
    console.error("[fetchCashierQueue] Invalid response shape:", parsed.error.flatten());
    throw new Error("Invalid response from cashier queue API");
  }

  return parsed.data;
}

// ─────────────────────────────────────────────────────────────────
// Query Hook
// ─────────────────────────────────────────────────────────────────

/**
 * Fetches the cashier queue with stats and recent collections.
 *
 * Features:
 * - Auto-refresh every 30 seconds for real-time updates
 * - Instant refetch after posting payments
 */
export function useCashierQueue() {
  return useQuery({
    queryKey: queryKeys.payments.queue(),
    queryFn: fetchCashierQueue,
    // Auto-refresh every 30 seconds
    refetchInterval: 30 * 1000,
    // Keep stale data visible while refetching
    staleTime: LIVE_DATA_STALE_TIME,
  });
}

// ─────────────────────────────────────────────────────────────────
// Mutation Hooks
// ─────────────────────────────────────────────────────────────────

/**
 * Post a payment.
 * Uses optimistic updates for instant UI feedback, then invalidates caches on success.
 */
type MutationContext = { previousQueue: CashierQueueResponse | undefined };

export function usePostPayment() {
  const queryClient = useQueryClient();

  return useMutation<PaymentFormState, Error, FormData, MutationContext>({
    mutationFn: async (formData) => {
      return postPaymentAction({}, formData);
    },
    onMutate: async (formData) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.payments.queue() });

      // Snapshot current state for rollback
      const previousQueue = queryClient.getQueryData<CashierQueueResponse>(
        queryKeys.payments.queue()
      );

      // Optimistically update the UI
      if (previousQueue) {
        const assessmentId = formData.get("assessmentId") as string | null;
        const amountStr = formData.get("amount") as string | null;
        const paymentAmount = amountStr ? parseFloat(amountStr) : 0;

        queryClient.setQueryData<CashierQueueResponse>(
          queryKeys.payments.queue(),
          (old) => {
            if (!old) return old;

            // Find the item being paid and update/remove it
            const updatedQueue = old.queue
              .map((item) => {
                if (item.assessmentId !== assessmentId) return item;
                // Calculate new balance after payment
                const newBalance = Math.max(0, item.balance - paymentAmount);
                // If fully paid, item will be removed; otherwise update balance
                return newBalance <= 0
                  ? null
                  : { ...item, balance: newBalance, totalPaid: item.totalPaid + paymentAmount };
              })
              .filter((item): item is CashierQueueRow => item !== null);

            return {
              ...old,
              queue: updatedQueue,
              stats: {
                ...old.stats,
                totalCollectedToday: old.stats.totalCollectedToday + paymentAmount,
                pendingPaymentsCount: updatedQueue.length,
              },
            };
          }
        );
      }

      return { previousQueue };
    },
    onError: (_error, _formData, context) => {
      // Rollback to previous state on error
      if (context?.previousQueue) {
        queryClient.setQueryData(queryKeys.payments.queue(), context.previousQueue);
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        // Full refresh to ensure accuracy (financial data must be correct)
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.queue(),
        });
        // Invalidate booklets (OR number was consumed)
        queryClient.invalidateQueries({
          queryKey: queryKeys.booklets.all,
        });
        // Invalidate assessments (balance updated). Intentionally broad: the
        // assessments directory list key (assessments.list({view,page})) lives
        // under assessments.all, so this refreshes it. Do NOT narrow to
        // byStudent/detail — that would stop the list from refreshing.
        queryClient.invalidateQueries({
          queryKey: queryKeys.assessments.all,
        });
      }
    },
    onSettled: () => {
      // Always refetch after mutation settles to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.queue() });
    },
  });
}

/**
 * Void a payment.
 * Invalidates the cashier queue and assessments cache on success.
 */
export function useVoidPayment() {
  const queryClient = useQueryClient();

  return useMutation<VoidPaymentFormState, Error, FormData, MutationContext>({
    mutationFn: async (formData) => {
      return voidPaymentAction({}, formData);
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.payments.queue() });
      // Snapshot for rollback (void doesn't need optimistic UI update, just cancellation)
      const previousQueue = queryClient.getQueryData<CashierQueueResponse>(
        queryKeys.payments.queue()
      );
      return { previousQueue };
    },
    onError: (_error, _formData, context) => {
      // Rollback on error
      if (context?.previousQueue) {
        queryClient.setQueryData(queryKeys.payments.queue(), context.previousQueue);
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate cashier queue
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.queue(),
        });
        // Invalidate assessments (balance reverted). Broad on purpose — refreshes
        // the assessments directory list (key sits under assessments.all).
        queryClient.invalidateQueries({
          queryKey: queryKeys.assessments.all,
        });
      }
    },
  });
}
