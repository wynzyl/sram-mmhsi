import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { ROLE_LABELS } from "@/lib/constants/roles";
import ResetPasswordForm from "@/components/users/ResetPasswordForm";

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
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{user.email}</h1>
          <p className="page-subtitle">User Account Details</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {canUpdate && (
            <Link href={`/admin/users/${id}/edit`} className="btn-primary">
              Edit User
            </Link>
          )}
          <Link href="/admin/users" className="btn-ghost">
            ← Back to Users
          </Link>
        </div>
      </div>

      <div className="profile-grid">
        {/* Main Details */}
        <div className="profile-card profile-card-wide">
          <h2 className="profile-card-title">Account Information</h2>
          <div className="profile-details">
            <div className="profile-detail-row">
              <span className="profile-detail-label">Email</span>
              <span className="profile-detail-value">{user.email}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Username</span>
              <span className="profile-detail-value">
                <code className="reference-code">{user.username}</code>
              </span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Role</span>
              <span className="profile-detail-value">
                <span className="badge badge-info">
                  {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                </span>
              </span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Status</span>
              <span className="profile-detail-value">
                <span className={`badge ${user.isActive ? "badge-success" : "badge-danger"}`}>
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Force Password Change</span>
              <span className="profile-detail-value">
                {user.forcePasswordChange ? "Yes" : "No"}
              </span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Created</span>
              <span className="profile-detail-value">
                {new Date(user.createdAt).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Last Updated</span>
              <span className="profile-detail-value">
                {new Date(user.updatedAt).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Reset Password Section */}
        {canUpdate && (
          <div className="profile-card profile-card-wide">
            <h2 className="profile-card-title">Reset Password</h2>
            <p className="text-muted mb-4">
              Generate a new password for this user. They will be required to change it on next login if the checkbox is checked.
            </p>
            <ResetPasswordForm userId={user.id} />
          </div>
        )}

        {/* Sidebar */}
        <div>
          <div className="profile-card">
            <h3 className="profile-card-title">Quick Actions</h3>
            <div className="flex flex-col gap-2">
              {canUpdate && (
                <Link href={`/admin/users/${id}/edit`} className="btn-secondary w-full">
                  Edit User Details
                </Link>
              )}
              <Link href="/admin/users" className="btn-ghost w-full">
                Back to User List
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
