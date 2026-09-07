import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requireSession } from "@/lib/auth/session";
import { STAFF_ROLES, normalizeRole } from "@/lib/constants/roles";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Register Student",
  description: "Choose how to register or enroll a learner.",
};

/**
 * Instant navigation - minimal skeleton shown during redirect.
 */
export default function StaffRegisterRedirectPage() {
  return (
    <Suspense fallback={<RedirectSkeleton />}>
      <RegisterRedirectContent />
    </Suspense>
  );
}

function RedirectSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

async function RegisterRedirectContent(): Promise<never> {
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
