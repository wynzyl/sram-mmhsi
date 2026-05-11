/**
 * Financial & Status Color Utilities
 * Provides semantic color classes for balance displays and status indicators
 */

/**
 * Returns Tailwind classes for balance display based on amount
 * - Zero balance: Success (green)
 * - Positive balance (owed): Error (red) with emphasis
 * - Negative balance: Muted (gray)
 */
export function getBalanceColor(balance: number): string {
  if (balance === 0) return "text-green-600 dark:text-green-500";
  if (balance > 0) return "text-red-600 dark:text-red-500 font-semibold";
  return "text-gray-500 dark:text-gray-400";
}

/**
 * Returns Tailwind classes for payment status badges
 * Maps payment status to appropriate badge styling
 */
export function getPaymentStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    paid: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    partial: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    unpaid: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  };

  return statusMap[status.toLowerCase()] || statusMap.unpaid;
}

/**
 * Returns Tailwind classes for enrollment status badges
 */
export function getEnrollmentStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    enrolled: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    withdrawn: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  };

  return statusMap[status.toLowerCase()] || statusMap.pending;
}

/**
 * Returns Tailwind classes for OR (Official Receipt) status badges
 */
export function getORStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    issued: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    cancelled: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    not_issued: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  };

  return statusMap[status.toLowerCase()] || statusMap.not_issued;
}
