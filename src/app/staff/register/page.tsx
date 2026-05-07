import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requireSession } from "@/lib/auth/session";
import { STAFF_ROLES, normalizeRole } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Register Student",
  description: "Choose how to register or enroll a learner.",
};

export default async function StaffRegisterRedirectPage() {
  await requireSession();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const role = normalizeRole(user.role);
  if (!role || !STAFF_ROLES.includes(role)) {
    redirect("/login");
  }

  redirect("/staff/students/new");
}
