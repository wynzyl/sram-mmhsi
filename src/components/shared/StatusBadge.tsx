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
type RequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "withdrawn";
type ClearanceStatus = "pending" | "cleared" | "waived";
type DiscountStatus = "pending" | "approved" | "rejected" | "cancelled" | "reversed";
type StudentArchiveStatus = "active" | "graduated" | "transferred" | "withdrawn" | "cancelled" | "inactive";
type DocumentRequestStatus = "requested" | "processing" | "ready" | "released" | "rejected" | "cancelled";

interface StatusBadgeProps {
  status:
    | PaymentStatus
    | EnrollmentStatus
    | ORStatus
    | BillingStatus
    | StudentType
    | RequestStatus
    | ClearanceStatus
    | DiscountStatus
    | StudentArchiveStatus
    | DocumentRequestStatus
    | string;
  type?:
    | "payment"
    | "enrollment"
    | "or"
    | "billing"
    | "studentType"
    | "request"
    | "clearance"
    | "discount"
    | "voidRequest"
    | "studentArchive"
    | "documentRequest";
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
  // Generic request status (cancellation requests, void requests, etc.)
  request: {
    pending: { variant: "warning" as const, label: "Pending" },
    approved: { variant: "success" as const, label: "Approved" },
    rejected: { variant: "danger" as const, label: "Rejected" },
    cancelled: { variant: "secondary" as const, label: "Cancelled" },
    withdrawn: { variant: "secondary" as const, label: "Withdrawn" },
  },
  // Clearance status
  clearance: {
    pending: { variant: "warning" as const, label: "Pending" },
    cleared: { variant: "success" as const, label: "Cleared" },
    waived: { variant: "info" as const, label: "Waived" },
  },
  // Discount request status
  discount: {
    pending: { variant: "warning" as const, label: "Pending" },
    approved: { variant: "success" as const, label: "Approved" },
    rejected: { variant: "danger" as const, label: "Rejected" },
    cancelled: { variant: "secondary" as const, label: "Cancelled" },
    reversed: { variant: "info" as const, label: "Reversed" },
  },
  // Void request status (alias for request, kept for semantic clarity)
  voidRequest: {
    pending: { variant: "warning" as const, label: "Pending" },
    approved: { variant: "success" as const, label: "Approved" },
    rejected: { variant: "danger" as const, label: "Rejected" },
    cancelled: { variant: "secondary" as const, label: "Cancelled" },
  },
  // Student archive status
  studentArchive: {
    active: { variant: "success" as const, label: "Active" },
    graduated: { variant: "info" as const, label: "Graduated" },
    transferred: { variant: "secondary" as const, label: "Transferred" },
    withdrawn: { variant: "warning" as const, label: "Withdrawn" },
    cancelled: { variant: "danger" as const, label: "Cancelled" },
    inactive: { variant: "secondary" as const, label: "Inactive" },
  },
  // Document request status
  documentRequest: {
    requested: { variant: "warning" as const, label: "Requested" },
    processing: { variant: "info" as const, label: "Processing" },
    ready: { variant: "success" as const, label: "Ready" },
    released: { variant: "success" as const, label: "Released" },
    rejected: { variant: "danger" as const, label: "Rejected" },
    cancelled: { variant: "secondary" as const, label: "Cancelled" },
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
