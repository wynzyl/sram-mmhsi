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
  | "finance";

/** One level of nested links (e.g. Register Student). Deeper nesting is not rendered. */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  children?: NavItem[];
  /** When set, active only if pathname equals href path (no `startsWith`); use for Master List vs `/staff/students/new`. */
  pathMatch?: "exact";
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_CONFIG: Record<Role, NavSection[]> = {
  admin: [
    {
      label: "Overview",
      items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Academic",
      items: [
        { href: "/admin/students", label: "Students", icon: "students" },
        { href: "/admin/registrations", label: "Registrations", icon: "registrations" },
        { href: "/admin/enrollments", label: "Enrollments", icon: "enrollments" },
        { href: "/admin/academics/subjects", label: "Subjects", icon: "subjects" },
        { href: "/admin/academics/assignments", label: "Assignments", icon: "assignments" },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: "/admin/finance/fee-schedules", label: "Fee Schedules", icon: "fee-schedules" },
        { href: "/admin/finance/booklets", label: "OR Booklets", icon: "booklets" },
        { href: "/admin/assessments", label: "Assessments", icon: "assessments" },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/users", label: "Users", icon: "users" },
        { href: "/admin/school-years", label: "School Years", icon: "school-years" },
      ],
    },
  ],

  registrar: [
    {
      label: "Registrar",
      items: [
        { href: "/staff/dashboard", label: "Dashboard", icon: "dashboard" },
        {
          href: "/staff/register",
          label: "Register Student",
          icon: "students",
          children: [
            { href: "/staff/students/new", label: "New Student", icon: "students" },
            { href: "/staff/students/new?intent=transferee", label: "Transferee", icon: "students" },
            { href: "/staff/enrollments/new", label: "Old Student", icon: "enrollments" },
          ],
        },
        { href: "/staff/registrations", label: "Verify Records", icon: "registrations" },
        { href: "/staff/enrollments", label: "Enrollment", icon: "enrollments", pathMatch: "exact" },
        { href: "/staff/students", label: "Master List", icon: "students", pathMatch: "exact" },
        { href: "/staff/enrollments/cancelled", label: "Cancelled Enrollments", icon: "enrollments" },
      ],
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
        { href: "/staff/finance/fee-schedules", label: "Fee Schedules", icon: "fee-schedules" },
        { href: "/staff/finance/booklets", label: "OR Booklets", icon: "booklets" },
        { href: "/staff/finance/invoices", label: "Invoices", icon: "invoices" },
      ],
    },
  ],

  cashier: [
    {
      label: "Overview",
      items: [{ href: "/staff/payments", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Cashier",
      items: [
        { href: "/staff/payments", label: "Payments", icon: "payments" },
        { href: "/staff/invoices", label: "Invoices", icon: "invoices" },
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
