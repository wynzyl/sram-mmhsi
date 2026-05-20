import { Badge } from "@/components/ui/badge";

type PaymentStatus = "paid" | "partial" | "unpaid";
type EnrollmentStatus =
  | "pending"
  | "assessed"
  | "enrolled"
  | "cancelled"
  | "withdrawn";
type ORStatus = "issued" | "cancelled" | "not_issued";
type BillingStatus = "fully_paid" | "outstanding" | "cancelled" | "balance_forwarded";
type StudentType = "new_student" | "transferee" | "old_student";

interface StatusBadgeProps {
  status: PaymentStatus | EnrollmentStatus | ORStatus | BillingStatus | StudentType | string;
  type?: "payment" | "enrollment" | "or" | "billing" | "studentType";
}

const statusConfig = {
  payment: {
    paid: { variant: "success" as const, label: "Paid" },
    partial: { variant: "warning" as const, label: "Partial" },
    unpaid: { variant: "danger" as const, label: "Unpaid" },
  },
  enrollment: {
    pending: { variant: "warning" as const, label: "Pending" },
    assessed: { variant: "secondary" as const, label: "Assessed" },
    enrolled: { variant: "success" as const, label: "Enrolled" },
    cancelled: { variant: "danger" as const, label: "Cancelled" },
    withdrawn: { variant: "secondary" as const, label: "Withdrawn" },
  },
  or: {
    issued: { variant: "success" as const, label: "Issued" },
    cancelled: { variant: "danger" as const, label: "Cancelled" },
    not_issued: { variant: "warning" as const, label: "Not Issued" },
  },
  billing: {
    fully_paid: { variant: "success" as const, label: "Fully Paid" },
    outstanding: { variant: "warning" as const, label: "Outstanding" },
    cancelled: { variant: "danger" as const, label: "Cancelled" },
    balance_forwarded: { variant: "info" as const, label: "Balance Forwarded" },
  },
  studentType: {
    new_student: { variant: "info" as const, label: "New" },
    transferee: { variant: "secondary" as const, label: "Transferee" },
    old_student: { variant: "success" as const, label: "Returning" },
  },
};

/**
 * Standardized status badge component for payment, enrollment, and OR statuses
 * Ensures consistent status display across the application
 */
export function StatusBadge({ status, type = "payment" }: StatusBadgeProps) {
  type BadgeConfig = {
    variant: "secondary" | "success" | "warning" | "danger" | "info";
    label: string;
  };

  const normalizedStatus = status.toLowerCase();
  const table = statusConfig[type] as Record<string, BadgeConfig> | undefined;
  const config: BadgeConfig =
    table?.[normalizedStatus] ?? {
      variant: "secondary",
      label: status.charAt(0).toUpperCase() + status.slice(1),
    };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
