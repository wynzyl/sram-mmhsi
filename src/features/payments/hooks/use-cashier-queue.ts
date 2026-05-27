"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { queryKeys } from "@/lib/query/keys";
import {
  postPaymentAction,
  voidPaymentAction,
} from "../payments.actions";
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
    staleTime: 15 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────
// Mutation Hooks
// ─────────────────────────────────────────────────────────────────

/**
 * Post a payment.
 * Invalidates the cashier queue and booklets cache on success.
 */
export function usePostPayment() {
  const queryClient = useQueryClient();

  return useMutation<PaymentFormState, Error, FormData>({
    mutationFn: async (formData) => {
      return postPaymentAction({}, formData);
    },
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate cashier queue (updates stats + recent collections)
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.queue(),
        });
        // Invalidate booklets (OR number was consumed)
        queryClient.invalidateQueries({
          queryKey: queryKeys.booklets.all,
        });
        // Invalidate assessments (balance updated)
        queryClient.invalidateQueries({
          queryKey: queryKeys.assessments.all,
        });
      }
    },
  });
}

/**
 * Void a payment.
 * Invalidates the cashier queue and assessments cache on success.
 */
export function useVoidPayment() {
  const queryClient = useQueryClient();

  return useMutation<VoidPaymentFormState, Error, FormData>({
    mutationFn: async (formData) => {
      return voidPaymentAction({}, formData);
    },
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate cashier queue
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.queue(),
        });
        // Invalidate assessments (balance reverted)
        queryClient.invalidateQueries({
          queryKey: queryKeys.assessments.all,
        });
      }
    },
  });
}
