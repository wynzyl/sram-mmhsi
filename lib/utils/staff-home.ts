import type { Role } from "@/lib/constants/roles";

/** Default staff landing when a route is not valid for the current role. */
export function staffHomePathForRole(role: Role): string {
  switch (role) {
    case "registrar":
      return "/staff/dashboard";
    case "finance_officer":
      return "/staff/finance";
    case "cashier":
      return "/staff/payments";
    case "teacher":
      return "/staff/grades";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/login";
  }
}
