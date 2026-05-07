import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import { normalizeRole, ROLES } from "@/lib/constants/roles";

/** Shared staff dashboard entry point redirects to role-specific staff homes. */
export default async function StaffDashboardPage() {
  const session = await requireSession();
  const role = normalizeRole(session.role);

  if (!role) {
    redirect("/login");
  }

  if (role === ROLES.SUPER_ADMIN) {
    redirect("/admin/dashboard");
  }

  redirect(staffHomePathForRole(role));
}
