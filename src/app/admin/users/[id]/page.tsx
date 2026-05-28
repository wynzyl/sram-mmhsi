import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/date";
import ResetPasswordForm from "@/features/users/components/ResetPasswordForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deletedAt)),
    columns: { email: true, username: true },
  });
  if (!user) return { title: "User Not Found" };
  return { title: `${user.email} — User Profile` };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) redirect("/admin/dashboard");

  // Fetch user
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deletedAt)),
    columns: {
      id: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      forcePasswordChange: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) notFound();

  const canUpdate = hasPermission(session.role, "users:manage");

  return (
    <div className="page-container space-y-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">{user.email}</h1>
          <p className="page-subtitle">User Account Details</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <Link href={`/admin/users/${id}/edit`} className="btn-primary">
              Edit User
            </Link>
          )}
          <Link href="/admin/users" className="btn-secondary">
            ← Back to Users
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="form-card space-y-5 lg:col-span-2">
          <h2 className="text-xl font-semibold text-foreground">Account Information</h2>
          <div className="grid gap-3 text-sm">
            <div className="grid gap-1 border-b border-border/70 pb-2 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="font-medium text-muted-foreground">Email</span>
              <span className="text-foreground">{user.email}</span>
            </div>
            <div className="grid gap-1 border-b border-border/70 pb-2 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="font-medium text-muted-foreground">Username</span>
              <span className="text-foreground">
                <code className="reference-code">{user.username}</code>
              </span>
            </div>
            <div className="grid gap-1 border-b border-border/70 pb-2 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="font-medium text-muted-foreground">Role</span>
              <span className="text-foreground">
                <span className="badge badge-secondary">
                  {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                </span>
              </span>
            </div>
            <div className="grid gap-1 border-b border-border/70 pb-2 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="font-medium text-muted-foreground">Status</span>
              <span className="text-foreground">
                <span className={`badge ${user.isActive ? "badge-success" : "badge-danger"}`}>
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </span>
            </div>
            <div className="grid gap-1 border-b border-border/70 pb-2 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="font-medium text-muted-foreground">Force Password Change</span>
              <span className="text-foreground">
                {user.forcePasswordChange ? "Yes" : "No"}
              </span>
            </div>
            <div className="grid gap-1 border-b border-border/70 pb-2 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="font-medium text-muted-foreground">Created</span>
              <span className="text-foreground">
                {formatDate(user.createdAt, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="font-medium text-muted-foreground">Last Updated</span>
              <span className="text-foreground">
                {formatDate(user.updatedAt, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <div className="form-card space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {canUpdate && (
                <Link href={`/admin/users/${id}/edit`} className="btn-secondary w-full">
                  Edit User Details
                </Link>
              )}
              <Link href="/admin/users" className="btn-secondary w-full">
                Back to User List
              </Link>
            </div>
          </div>
        </div>

        {/* Reset Password Section */}
        {canUpdate && (
          <div className="form-card space-y-3 lg:col-span-2">
            <h2 className="text-xl font-semibold text-foreground">Reset Password</h2>
            <p className="text-sm text-muted-foreground">
              Generate a new password for this user. They will be required to change it on next login if the checkbox is checked.
            </p>
            <ResetPasswordForm userId={user.id} />
          </div>
        )}
      </div>
    </div>
  );
}
