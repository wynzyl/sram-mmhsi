import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { PortalChangePasswordForm } from "@/features/portal-accounts/components/PortalChangePasswordForm";
import { ChangePasswordFormSkeleton } from "@/features/auth";
import { logoutAction } from "@/features/auth/auth.actions";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Change Password",
  description: "Change your Student Portal password.",
};

/**
 * Password change page for portal users, serving two flows:
 * - Forced: proxy.ts redirects portal sessions with forcePasswordChange here
 *   and bounces every other route back until the password is changed.
 * - Voluntary: reachable any time via "Change Password" in the portal header
 *   user menu. Copy, footer link, and the DOB hint adapt to the flow.
 *
 * Lives in the (portal-auth) route group so it does NOT inherit
 * src/app/portal/layout.tsx. The URL is unchanged, but the full-bleed auth
 * card no longer renders inside the sidebar, header and footer chrome.
 *
 * Note: cannot use requirePortalSession() here. That would redirect to login,
 * but a forced user IS logged in, they just need to change their password.
 */
async function PortalChangePasswordDescription() {
  const session = await getCurrentSession();
  const forced = session?.forcePasswordChange ?? true;

  return (
    <p className="auth-description">
      {forced
        ? "For your security, please create a new password before continuing."
        : "Choose a new password for your portal account. You will be asked to sign in again afterwards."}
    </p>
  );
}

async function PortalChangePasswordContent() {
  const session = await getCurrentSession();

  if (!session || session.accountSource !== "portal" || !session.studentId) {
    redirect("/login");
  }

  const forced = session.forcePasswordChange ?? false;

  return (
    <>
      <PortalChangePasswordForm forced={forced} />

      <footer className="auth-footer">
        {forced ? (
          <form action={logoutAction}>
            <button type="submit" className="auth-link">
              Sign out instead
            </button>
          </form>
        ) : (
          <Link href="/portal/dashboard" className="auth-link">
            Back to dashboard
          </Link>
        )}
      </footer>
    </>
  );
}

export default function PortalChangePasswordPage() {
  return (
    <main className="auth-page-bg">

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
          {/* Session access is uncached, so the session-aware copy needs its
              own boundary; the static card shell renders immediately. */}
          <Suspense fallback={<Skeleton className="mx-auto mt-2 h-4 w-64" />}>
            <PortalChangePasswordDescription />
          </Suspense>
          <span className="auth-divider" aria-hidden="true" />
        </header>

        {/* Session access is uncached, so it needs its own boundary now that
            this page no longer sits inside the portal layout's Suspense. */}
        <Suspense fallback={<ChangePasswordFormSkeleton />}>
          <PortalChangePasswordContent />
        </Suspense>
      </section>
    </main>
  );
}
