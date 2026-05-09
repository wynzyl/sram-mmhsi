import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import UserForm from "@/features/users/components/UserForm";

export const metadata: Metadata = {
  title: "Create User",
  description: "Create a new user account in SRAMS.",
};

export default async function CreateUserPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) redirect("/admin/dashboard");

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create User</h1>
          <p className="page-subtitle">Add a new user account to the system</p>
        </div>
        <Link href="/admin/users" className="btn-ghost">
          ← Back to Users
        </Link>
      </div>

      <UserForm />
    </div>
  );
}
