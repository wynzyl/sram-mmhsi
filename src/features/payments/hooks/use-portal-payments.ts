"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { financialFreshness } from "@/lib/query/staleness";
import type { PortalPaymentsData } from "../payments.queries";

async function fetchPortalPayments(): Promise<PortalPaymentsData> {
  const res = await fetch("/api/portal/payments");
  if (!res.ok) {
    throw new Error(`Failed to fetch payments: ${res.status}`);
  }
  return res.json();
}

/** Read-only portal payment history (always-fresh financial data). */
export function usePortalPayments() {
  return useQuery({
    queryKey: queryKeys.payments.list({ scope: "portal" }),
    queryFn: fetchPortalPayments,
    ...financialFreshness(),
  });
}
