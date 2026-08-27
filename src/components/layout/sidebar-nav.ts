import type { Role } from "@/lib/constants/roles";

export type NavIconName =
  | "dashboard"
  | "students"
  | "registrations"
  | "enrollments"
  | "curriculums"
  | "sections"
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
  | "documents"
  | "strands"
  | "electives"
  // Collapsible parent icons
  | "records"
  | "academics"
  | "billing"
  | "approvals"
  | "system";

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
      label: "Management",
      items: [
        {
          href: "/staff/academics",
          label: "Academics",
          icon: "academics",
          children: [
            { href: "/staff/academics/curriculums", label: "Curriculums", icon: "curriculums" },
            { href: "/staff/academics/sections", label: "Sections", icon: "sections" },
            { href: "/staff/academics/section-assignments", label: "Assignments", icon: "assignments" },
            { href: "/staff/academics/advisers", label: "Advisers", icon: "users" },
            { href: "/staff/academics/strands", label: "SHS Strands", icon: "strands" },
            { href: "/staff/academics/electives", label: "SHS Electives", icon: "electives" },
          ],
        },
        {
          href: "/staff/grades",
          label: "Grades",
          icon: "grades",
          children: [
            { href: "/staff/grades", label: "Overview", icon: "grades", pathMatch: "exact" },
            { href: "/staff/grades/approvals", label: "Pending Approvals", icon: "grades" },
          ],
        },
        {
          href: "/staff/approvals",
          label: "Approvals",
          icon: "approvals",
          children: [
            { href: "/staff/approvals", label: "Pending Approvals", icon: "void-requests", pathMatch: "exact" },
          ],
        },
        {
          href: "/staff/archive",
          label: "Archive",
          icon: "archive",
          children: [
            { href: "/staff/archive", label: "Archived Students", icon: "archive", pathMatch: "exact" },
            { href: "/staff/archive/documents", label: "Document Requests", icon: "documents" },
          ],
        },
        {
          href: "/staff/reports",
          label: "Reports",
          icon: "reports",
          children: [
            { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
            { href: "/staff/reports/payment-collection", label: "Payment Collection", icon: "reports" },
            { href: "/staff/reports/accounts-receivable", label: "Accounts Receivable", icon: "reports" },
            { href: "/staff/reports/student-list", label: "Student List", icon: "reports" },
          ],
        },
        {
          href: "/admin/users",
          label: "System",
          icon: "system",
          children: [
            { href: "/admin/users", label: "Users", icon: "users", pathMatch: "exact" },
            { href: "/staff/school-years", label: "School Years", icon: "school-years" },
          ],
        },
      ],
    },
  ],

  admin: [
    {
      label: "Overview",
      items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Management",
      items: [
        {
          href: "/staff/academics",
          label: "Academics",
          icon: "academics",
          children: [
            { href: "/staff/academics/curriculums", label: "Curriculums", icon: "curriculums" },
            { href: "/staff/academics/sections", label: "Sections", icon: "sections" },
            { href: "/staff/academics/section-assignments", label: "Assignments", icon: "assignments" },
            { href: "/staff/academics/advisers", label: "Advisers", icon: "users" },
            { href: "/staff/academics/strands", label: "SHS Strands", icon: "strands" },
            { href: "/staff/academics/electives", label: "SHS Electives", icon: "electives" },
          ],
        },
        {
          href: "/staff/grades",
          label: "Grades",
          icon: "grades",
          children: [
            { href: "/staff/grades", label: "Overview", icon: "grades", pathMatch: "exact" },
            { href: "/staff/grades/approvals", label: "Pending Approvals", icon: "grades" },
          ],
        },
        {
          href: "/staff/students",
          label: "Records",
          icon: "records",
          children: [
            { href: "/staff/students", label: "Students", icon: "students", pathMatch: "exact" },
            { href: "/staff/registrations", label: "Registrations", icon: "registrations" },
            { href: "/staff/enrollments", label: "Enrollments", icon: "enrollments" },
          ],
        },
        {
          href: "/staff/assessments",
          label: "Billing",
          icon: "billing",
          children: [
            { href: "/staff/assessments", label: "Assessments", icon: "assessments", pathMatch: "exact" },
            { href: "/staff/payments", label: "Payments", icon: "payments" },
            { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
            { href: "/staff/finance/setup", label: "Billing Setup", icon: "fee-schedules" },
          ],
        },
        {
          href: "/staff/approvals",
          label: "Approvals",
          icon: "approvals",
          children: [
            { href: "/staff/approvals", label: "Pending Approvals", icon: "void-requests", pathMatch: "exact" },
          ],
        },
        {
          href: "/staff/archive",
          label: "Archive",
          icon: "archive",
          children: [
            { href: "/staff/archive", label: "Archived Students", icon: "archive", pathMatch: "exact" },
            { href: "/staff/archive/documents", label: "Document Requests", icon: "documents" },
          ],
        },
        {
          href: "/staff/reports",
          label: "Reports",
          icon: "reports",
          children: [
            { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
            { href: "/staff/reports/payment-collection", label: "Payment Collection", icon: "reports" },
            { href: "/staff/reports/accounts-receivable", label: "Accounts Receivable", icon: "reports" },
            { href: "/staff/reports/student-list", label: "Student List", icon: "reports" },
          ],
        },
        {
          href: "/admin/users",
          label: "System",
          icon: "system",
          children: [
            { href: "/admin/users", label: "Users", icon: "users", pathMatch: "exact" },
            { href: "/staff/school-years", label: "School Years", icon: "school-years" },
          ],
        },
      ],
    },
  ],

  registrar: [
    {
      label: "Overview",
      items: [{ href: "/staff/dashboard", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Management",
      items: [
        {
          href: "/staff/academics/curriculums",
          label: "Academics",
          icon: "academics",
          children: [
            { href: "/staff/academics/curriculums", label: "Curriculums", icon: "curriculums" },
          ],
        },
        {
          href: "/staff/students",
          label: "Records",
          icon: "records",
          children: [
            { href: "/staff/students", label: "Students", icon: "students", pathMatch: "exact" },
            { href: "/staff/registrations", label: "Registrations", icon: "registrations" },
            { href: "/staff/enrollments", label: "Enrollments", icon: "enrollments" },
          ],
        },
        {
          href: "/staff/assessments",
          label: "Billing",
          icon: "billing",
          children: [
            { href: "/staff/assessments", label: "Assessments", icon: "assessments", pathMatch: "exact" },
            { href: "/staff/payments", label: "Payments", icon: "payments" },
          ],
        },
        {
          href: "/staff/approvals",
          label: "Approvals",
          icon: "approvals",
          children: [
            { href: "/staff/approvals", label: "Pending Approvals", icon: "void-requests", pathMatch: "exact" },
          ],
        },
        {
          href: "/staff/archive",
          label: "Archive",
          icon: "archive",
          children: [
            { href: "/staff/archive", label: "Archived Students", icon: "archive", pathMatch: "exact" },
            { href: "/staff/archive/documents", label: "Document Requests", icon: "documents" },
          ],
        },
        {
          href: "/staff/reports",
          label: "Reports",
          icon: "reports",
          children: [
            { href: "/staff/reports/payment-collection", label: "Payment Collection", icon: "reports" },
            { href: "/staff/reports/student-list", label: "Student List", icon: "reports" },
          ],
        },
      ],
    },
  ],

  finance_officer: [
    {
      label: "Overview",
      items: [{ href: "/staff/finance", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Management",
      items: [
        {
          href: "/staff/assessments",
          label: "Billing",
          icon: "billing",
          children: [
            { href: "/staff/assessments", label: "Assessments", icon: "assessments", pathMatch: "exact" },
            { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
            { href: "/staff/finance/setup", label: "Billing Setup", icon: "fee-schedules" },
          ],
        },
        {
          href: "/staff/approvals",
          label: "Approvals",
          icon: "approvals",
          children: [
            { href: "/staff/approvals", label: "Pending Approvals", icon: "void-requests", pathMatch: "exact" },
          ],
        },
        {
          href: "/staff/reports",
          label: "Reports",
          icon: "reports",
          children: [
            { href: "/staff/reports/balance-forwards", label: "Balance Forwards", icon: "reports" },
            { href: "/staff/reports/accounts-receivable", label: "Accounts Receivable", icon: "reports" },
            { href: "/staff/reports/student-list", label: "Student List", icon: "reports" },
          ],
        },
      ],
    },
  ],

  cashier: [
    {
      label: "Operations",
      items: [
        {
          href: "/staff/payments",
          label: "Billing",
          icon: "billing",
          children: [
            { href: "/staff/payments", label: "Payments", icon: "payments", pathMatch: "exact" },
            { href: "/staff/student-ledgers", label: "Student Ledger", icon: "assessments" },
            { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
          ],
        },
        {
          href: "/staff/approvals",
          label: "Approvals",
          icon: "approvals",
          children: [
            { href: "/staff/approvals", label: "Pending Approvals", icon: "void-requests", pathMatch: "exact" },
          ],
        },
        {
          href: "/staff/reports",
          label: "Reports",
          icon: "reports",
          children: [
            { href: "/staff/reports/payment-collection", label: "Payment Collection", icon: "reports" },
          ],
        },
      ],
    },
  ],

  teacher: [
    {
      label: "Academics",
      items: [{ href: "/staff/grades", label: "My Classes", icon: "grades" }],
    },
  ],

  coordinator: [
    {
      label: "Grades",
      items: [
        { href: "/staff/grades", label: "My Sections", icon: "grades" },
      ],
    },
    {
      label: "Management",
      items: [
        {
          href: "/staff/academics",
          label: "Academics",
          icon: "academics",
          children: [
            { href: "/staff/academics/sections", label: "Sections", icon: "sections" },
            { href: "/staff/academics/section-assignments", label: "Assignments", icon: "assignments" },
            { href: "/staff/academics/advisers", label: "Advisers", icon: "users" },
          ],
        },
      ],
    },
  ],

  principal: [
    {
      label: "Grades",
      items: [
        { href: "/staff/grades", label: "Overview", icon: "grades" },
        { href: "/staff/grades/approvals", label: "Pending Approvals", icon: "grades" },
      ],
    },
    {
      label: "Management",
      items: [
        {
          href: "/staff/academics",
          label: "Academics",
          icon: "academics",
          children: [
            { href: "/staff/academics/sections", label: "Sections", icon: "sections" },
            { href: "/staff/academics/section-assignments", label: "Assignments", icon: "assignments" },
            { href: "/staff/academics/advisers", label: "Advisers", icon: "users" },
          ],
        },
      ],
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
