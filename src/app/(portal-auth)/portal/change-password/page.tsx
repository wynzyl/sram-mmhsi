import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { PortalChangePasswordForm } from "@/features/portal-accounts/components/PortalChangePasswordForm";
import { logoutAction } from "@/features/auth/auth.actions";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Change Password",
  description: "Change your password to continue using the Student Portal.",
};

/**
 * Force password change page for portal users.
 *
 * Lives in the (portal-auth) route group so it does NOT inherit
 * src/app/portal/layout.tsx. The URL is unchanged, but the full-bleed auth
 * card no longer renders inside the sidebar, header and footer chrome, and
 * the sidebar no longer offers links that proxy.ts would bounce straight back.
 *
 * Note: cannot use requirePortalSession() here. That would redirect to login,
 * but the user IS logged in, they just need to change their password.
 */
async function PortalChangePasswordContent() {
  const session = await getCurrentSession();

  if (!session || session.accountSource !== "portal" || !session.studentId) {
    redirect("/login");
  }

  if (!session.forcePasswordChange) {
    redirect("/portal/dashboard");
  }

  return <PortalChangePasswordForm />;
}

function ChangePasswordFormSkeleton() {
  return (
    <div className="flex flex-col gap-[1.125rem]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="mt-1 h-11 w-full rounded-md" />
    </div>
  );
}

export default function PortalChangePasswordPage() {
  return (
    <main className="auth-page-bg">
      {/* Grain texture overlay */}
      <div className="auth-grain-overlay" aria-hidden="true" />

      <section className="auth-card" aria-labelledby="change-password-title">
        <header className="auth-header">
          <span className="auth-logo-wrapper" aria-hidden="true">
            <Image
              src="/Hero.png"
              alt=""
              width={56}
              height={56}
              priority
              className="h-full w-full object-cover"
            />
          </span>

          <p className="auth-subtitle">Student Portal</p>
          <h1 id="change-password-title" className="auth-title">
            Change <span className="auth-title-accent">Password</span>
          </h1>
          <p className="auth-description">
            For your security, please create a new password before continuing.
          </p>
          <span className="auth-divider" aria-hidden="true" />
        </header>

        {/* Session access is uncached, so it needs its own boundary now that
            this page no longer sits inside the portal layout's Suspense. */}
        <Suspense fallback={<ChangePasswordFormSkeleton />}>
          <PortalChangePasswordContent />
        </Suspense>

        <footer className="auth-footer">
          <form action={logoutAction}>
            <button type="submit" className="auth-link">
              Sign out instead
            </button>
          </form>
        </footer>
      </section>
    </main>
  );
}
