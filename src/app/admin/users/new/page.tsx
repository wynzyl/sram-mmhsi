import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import UserForm from "@/features/users/components/UserForm";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Create User",
  description: "Create a new user account in SRAMS.",
};

/**
 * Instant navigation - full create user form skeleton shown while data loads.
 */
export default function CreateUserPage() {
  return (
    <Suspense fallback={<CreateUserSkeleton />}>
      <CreateUserContent />
    </Suspense>
  );
}

function CreateUserSkeleton() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4 mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-12 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="pt-2 flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

async function CreateUserContent() {
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
