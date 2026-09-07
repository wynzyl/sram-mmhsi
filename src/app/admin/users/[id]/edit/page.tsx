import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import EditUserForm from "@/features/users/components/EditUserForm";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

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

/**
 * Static shell - header renders immediately.
 */
export default async function EditUserPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit User</h1>
          <p className="page-subtitle">Loading...</p>
        </div>
        <Link href={`/admin/users/${id}`} className="btn-secondary">
          ← Back to Profile
        </Link>
      </div>

      <Suspense fallback={<EditFormSkeleton />}>
        <EditUserContent id={id} />
      </Suspense>
    </div>
  );
}

function EditFormSkeleton() {
  return (
    <div className="form-card space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

async function EditUserContent({ id }: { id: string }) {
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) redirect("/admin/dashboard");

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

  return <EditUserForm user={user} />;
}
