import { Badge } from "@/components/ui/badge";

type PaymentStatus = "paid" | "partial" | "unpaid";
type EnrollmentStatus = "pending" | "enrolled" | "withdrawn";
type ORStatus = "issued" | "cancelled" | "not_issued";

interface StatusBadgeProps {
  status: PaymentStatus | EnrollmentStatus | ORStatus | string;
  type?: "payment" | "enrollment" | "or";
}

const statusConfig = {
  payment: {
    paid: { variant: "success" as const, label: "Paid" },
    partial: { variant: "warning" as const, label: "Partial" },
    unpaid: { variant: "danger" as const, label: "Unpaid" },
  },
  enrollment: {
    pending: { variant: "warning" as const, label: "Pending" },
    enrolled: { variant: "success" as const, label: "Enrolled" },
    withdrawn: { variant: "secondary" as const, label: "Withdrawn" },
  },
  or: {
    issued: { variant: "success" as const, label: "Issued" },
    cancelled: { variant: "danger" as const, label: "Cancelled" },
    not_issued: { variant: "warning" as const, label: "Not Issued" },
  },
};

/**
 * Standardized status badge component for payment, enrollment, and OR statuses
 * Ensures consistent status display across the application
 */
export function StatusBadge({ status, type = "payment" }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const config =
    statusConfig[type]?.[
      normalizedStatus as keyof (typeof statusConfig)[typeof type]
    ] || {
      variant: "secondary" as const,
      label: status.charAt(0).toUpperCase() + status.slice(1),
    };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
