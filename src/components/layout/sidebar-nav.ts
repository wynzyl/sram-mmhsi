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
  | "discounts"
  | "cancellation-requests"
  | "clearances"
  | "archive"
  | "documents";

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
      label: "Academics",
      items: [
        { href: "/staff/academics/subjects", label: "Subjects", icon: "subjects" },
      ],
    },
    {
      label: "Approvals",
      items: [
        { href: "/staff/approvals", label: "Approvals", icon: "void-requests" },
      ],
    },
    {
      label: "Archive",
      items: [
        { href: "/staff/archive", label: "Archived Students", icon: "archive", pathMatch: "exact" },
        { href: "/staff/archive/documents", label: "Document Requests", icon: "documents" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
        { href: "/staff/reports/payment-collection", label: "Payment Collection", icon: "reports" },
        { href: "/staff/reports/accounts-receivable", label: "Accounts Receivable", icon: "reports" },
        { href: "/staff/reports/student-list", label: "Student List", icon: "reports" },
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
      label: "Records",
      items: [
        { href: "/staff/students", label: "Students", icon: "students" },
        { href: "/staff/registrations", label: "Registrations", icon: "registrations" },
        { href: "/staff/enrollments", label: "Enrollments", icon: "enrollments" },
      ],
    },
    {
      label: "Academics",
      items: [
        { href: "/staff/academics/subjects", label: "Subjects", icon: "subjects" },
      ],
    },
    {
      label: "Billing",
      items: [
        { href: "/staff/assessments", label: "Assessments", icon: "assessments" },
        { href: "/staff/payments", label: "Payments", icon: "payments" },
        { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
        { href: "/staff/finance/setup", label: "Billing Setup", icon: "fee-schedules" },
      ],
    },
    {
      label: "Approvals",
      items: [
        { href: "/staff/approvals", label: "Approvals", icon: "void-requests" },
      ],
    },
    {
      label: "Archive",
      items: [
        { href: "/staff/archive", label: "Archived Students", icon: "archive", pathMatch: "exact" },
        { href: "/staff/archive/documents", label: "Document Requests", icon: "documents" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
        { href: "/staff/reports/payment-collection", label: "Payment Collection", icon: "reports" },
        { href: "/staff/reports/accounts-receivable", label: "Accounts Receivable", icon: "reports" },
        { href: "/staff/reports/student-list", label: "Student List", icon: "reports" },
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

  registrar: [
    {
      label: "Overview",
      items: [{ href: "/staff/dashboard", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Records",
      items: [
        { href: "/staff/students", label: "Students", icon: "students" },
        { href: "/staff/registrations", label: "Registrations", icon: "registrations" },
        { href: "/staff/enrollments", label: "Enrollments", icon: "enrollments" },
      ],
    },
    {
      label: "Academics",
      items: [
        { href: "/staff/academics/subjects", label: "Subjects", icon: "subjects" },
      ],
    },
    {
      label: "Billing",
      items: [
        { href: "/staff/assessments", label: "Assessments", icon: "assessments" },
        { href: "/staff/payments", label: "Payments", icon: "payments" },
      ],
    },
    {
      label: "Approvals",
      items: [
        { href: "/staff/approvals", label: "Approvals", icon: "void-requests" },
      ],
    },
    {
      label: "Archive",
      items: [
        { href: "/staff/archive", label: "Archived Students", icon: "archive", pathMatch: "exact" },
        { href: "/staff/archive/documents", label: "Document Requests", icon: "documents" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/payment-collection", label: "Payment Collection", icon: "reports" },
        { href: "/staff/reports/student-list", label: "Student List", icon: "reports" },
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
      label: "Billing",
      items: [
        { href: "/staff/assessments", label: "Assessments", icon: "assessments" },
        { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
        { href: "/staff/finance/setup", label: "Billing Setup", icon: "fee-schedules" },
      ],
    },
    {
      label: "Approvals",
      items: [
        { href: "/staff/approvals", label: "Approvals", icon: "void-requests" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
        { href: "/staff/reports/accounts-receivable", label: "Accounts Receivable", icon: "reports" },
        { href: "/staff/reports/student-list", label: "Student List", icon: "reports" },
      ],
    },
  ],

  cashier: [
    {
      label: "Cashier",
      items: [
        { href: "/staff/payments", label: "Payments", icon: "payments" },
        { href: "/staff/student-ledgers", label: "Student Ledger", icon: "assessments" },
        { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
      ],
    },
    {
      label: "Approvals",
      items: [
        { href: "/staff/approvals", label: "Approvals", icon: "void-requests" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/staff/reports/payment-collection", label: "Payment Collection", icon: "reports" },
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
