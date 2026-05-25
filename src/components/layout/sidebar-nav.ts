import type { Role } from "@/lib/constants/roles";

export type NavIconName =
  | "dashboard"
  | "students"
  | "registrations"
  | "enrollments"
  | "subjects"
  | "assignments"
  | "fee-schedules"
  | "booklets"
  | "assessments"
  | "users"
  | "school-years"
  | "grades"
  | "payments"
  | "invoices"
  | "finance"
  | "fee-item-types"
  | "void-requests"
  | "reports"
  | "discounts";

/** One level of nested links (e.g. Register Student). Deeper nesting is not rendered. */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  children?: NavItem[];
  /** When set, active only if pathname equals href path (no `startsWith`); use for Master List vs `/staff/students/new`. */
  pathMatch?: "exact";
  /** If pathname matches this item's path but this query param equals `value`, item is not active (e.g. Enrollments vs cancelled-only list). */
  notActiveWhen?: { param: string; value: string };
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_CONFIG: Record<Role, NavSection[]> = {
  super_admin: [
    {
      label: "Overview",
      items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Finance",
      items: [
        { href: "/staff/void-requests", label: "Void Requests", icon: "void-requests" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/users", label: "Users", icon: "users" },
        { href: "/staff/school-years", label: "School Years", icon: "school-years" },
      ],
    },
  ],

  admin: [
    {
      label: "Overview",
      items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Academic",
      items: [
        { href: "/staff/students", label: "Students", icon: "students" },
        { href: "/staff/registrations", label: "Registrations", icon: "registrations" },
        { href: "/staff/enrollments", label: "Enrollments", icon: "enrollments" },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: "/staff/assessments", label: "Assessments", icon: "assessments" },
        { href: "/staff/student-ledgers", label: "Student Ledger", icon: "assessments" },
        { href: "/staff/finance/fee-schedules", label: "Fee Schedules", icon: "fee-schedules" },
        { href: "/staff/finance/fee-item-types", label: "Fee Item Types", icon: "fee-item-types" },
        { href: "/staff/finance/booklets", label: "OR Booklets", icon: "booklets" },
        { href: "/staff/finance/discount-types", label: "Discount Types", icon: "discounts" },
        { href: "/staff/finance/discount-requests", label: "Discount Requests", icon: "discounts" },
      ],
    },
    {
      label: "Cashier",
      items: [
        { href: "/staff/payments/dashboard", label: "Cashier Dashboard", icon: "dashboard" },
        { href: "/staff/payments", label: "Payment Queue", icon: "payments" },
        { href: "/staff/void-requests", label: "Void Requests", icon: "void-requests" },
        { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/staff/school-years", label: "School Years", icon: "school-years" },
      ],
    },
  ],

  registrar: [
    {
      label: "Overview",
      items: [{ href: "/staff/dashboard", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Academic",
      items: [
        { href: "/staff/students", label: "Students", icon: "students" },
        { href: "/staff/registrations", label: "Registrations", icon: "registrations" },
        {
          href: "/staff/enrollments",
          label: "Enrollments",
          icon: "enrollments",
          notActiveWhen: { param: "status", value: "cancelled" },
        },
        {
          href: "/staff/enrollments?status=cancelled",
          label: "Cancelled Enrollments",
          icon: "enrollments",
        },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: "/staff/assessments", label: "Assessments", icon: "assessments" },
        { href: "/staff/student-ledgers", label: "Student Ledger", icon: "assessments" },
        { href: "/staff/finance/fee-item-types", label: "Fee Item Types", icon: "fee-item-types" },
      ],
    },
    {
      label: "Cashier",
      items: [
        { href: "/staff/payments/dashboard", label: "Cashier Dashboard", icon: "dashboard" },
        { href: "/staff/payments", label: "Payment Queue", icon: "payments" },
        { href: "/staff/void-requests", label: "Void Requests", icon: "void-requests" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
      ],
    },
    {
      label: "System",
      items: [{ href: "/staff/school-years", label: "School Years", icon: "school-years" }],
    },
  ],

  finance_officer: [
    {
      label: "Overview",
      items: [{ href: "/staff/finance", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Finance",
      items: [
        { href: "/staff/assessments", label: "Assessments", icon: "assessments" },
        { href: "/staff/student-ledgers", label: "Student Ledger", icon: "assessments" },
        { href: "/staff/finance/fee-schedules", label: "Fee Schedules", icon: "fee-schedules" },
        { href: "/staff/finance/fee-item-types", label: "Fee Item Types", icon: "fee-item-types" },
        { href: "/staff/finance/booklets", label: "OR Booklets", icon: "booklets" },
        { href: "/staff/finance/discount-types", label: "Discount Types", icon: "discounts" },
        { href: "/staff/finance/discount-requests", label: "Discount Requests", icon: "discounts" },
        { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
      ],
    },
  ],

  cashier: [
    {
      label: "Overview",
      items: [{ href: "/staff/payments/dashboard", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Cashier",
      items: [
        { href: "/staff/payments", label: "Payments", icon: "payments" },
        { href: "/staff/student-ledgers", label: "Student Ledger", icon: "assessments" },
        { href: "/staff/void-requests", label: "Void Requests", icon: "void-requests" },
        { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
      ],
    },
  ],

  teacher: [
    {
      label: "Academics",
      items: [{ href: "/staff/grades", label: "My Classes", icon: "grades" }],
    },
  ],

  student: [
    {
      label: "My Account",
      items: [
        { href: "/portal/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/portal/assessments", label: "Assessments", icon: "assessments" },
        { href: "/portal/payments", label: "Payments", icon: "payments" },
        { href: "/portal/grades", label: "Grades", icon: "grades" },
      ],
    },
  ],

  parent_guardian: [
    {
      label: "My Student",
      items: [
        { href: "/portal/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/portal/assessments", label: "Assessments", icon: "assessments" },
        { href: "/portal/payments", label: "Payments", icon: "payments" },
        { href: "/portal/grades", label: "Grades", icon: "grades" },
      ],
    },
  ],
};
