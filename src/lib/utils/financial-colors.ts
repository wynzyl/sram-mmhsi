/**
 * Financial & Status Color Utilities
 * Provides semantic color classes for balance displays and status indicators
 * Uses shadcn/ui semantic colors for theme consistency
 */

/**
 * Returns Tailwind classes for balance display based on amount
 * - Zero balance: Success (emerald)
 * - Positive balance (owed): Destructive (red)
 * - Negative balance: Muted
 */
export function getBalanceColor(balance: number): string {
  if (balance === 0) return "text-emerald-600 dark:text-emerald-400";
  if (balance > 0) return "text-destructive font-semibold";
  return "text-muted-foreground";
}

/**
 * Returns Tailwind classes for payment status badges
 * Maps payment status to appropriate badge styling
 */
export function getPaymentStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    unpaid: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return statusMap[status.toLowerCase()] || "bg-muted text-muted-foreground";
}

/**
 * Returns Tailwind classes for enrollment status badges
 */
export function getEnrollmentStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    assessed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    enrolled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    withdrawn: "bg-muted text-muted-foreground",
  };

  return statusMap[status.toLowerCase()] || "bg-muted text-muted-foreground";
}

/**
 * Returns Tailwind classes for billing status badges
 */
export function getBillingStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    outstanding: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    fully_paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    balance_forwarded: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return statusMap[status.toLowerCase()] || "bg-muted text-muted-foreground";
}

/**
 * Returns Tailwind classes for OR (Official Receipt) status badges
 */
export function getORStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    issued: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    voided: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    not_issued: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return statusMap[status.toLowerCase()] || "bg-muted text-muted-foreground";
}
