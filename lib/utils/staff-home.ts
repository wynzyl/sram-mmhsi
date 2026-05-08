import type { Role } from "@/lib/constants/roles";

/** Default staff landing when a route is not valid for the current role. */
export function staffHomePathForRole(role: Role): string {
  switch (role) {
    case "super_admin":
      return "/admin/dashboard";
    case "registrar":
      return "/staff/registrations";
    case "finance_officer":
      return "/staff/finance";
    case "cashier":
      return "/staff/payments";
    case "teacher":
      return "/staff/grades";
    case "admin":
      return "/staff/registrations";
    default:
      return "/login";
  }
}
