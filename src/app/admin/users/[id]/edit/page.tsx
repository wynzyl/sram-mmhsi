import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import EditUserForm from "@/components/users/EditUserForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deletedAt)),
    columns: { email: true },
  });
  if (!user) return { title: "User Not Found" };
  return { title: `Edit ${user.email}` };
}

export default async function EditUserPage({ params }: PageProps) {
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
    },
  });

  if (!user) notFound();

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit User</h1>
          <p className="page-subtitle">{user.email}</p>
        </div>
        <Link href={`/admin/users/${id}`} className="btn-ghost">
          ← Back to Profile
        </Link>
      </div>

      <EditUserForm user={user} />
    </div>
  );
}
