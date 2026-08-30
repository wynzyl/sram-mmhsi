import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { ChangePasswordForm, ChangePasswordFormSkeleton } from "@/features/auth";
import { logoutAction } from "@/features/auth/auth.actions";
import { ROLE_LANDING } from "@/lib/constants/roles";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Change Password · SRAMS",
  description: "Change your SRAMS account password.",
};

/**
 * This page serves two flows:
 * - Forced: proxy.ts redirects staff whose session has forcePasswordChange
 *   here and bounces every other route back until the password is changed.
 * - Voluntary: reachable any time via "Change Password" in the header user
 *   menu. Copy and footer link adapt to which flow the visitor is in.
 */
async function ChangePasswordDescription() {
  const session = await getCurrentSession();
  const forced = session?.forcePasswordChange ?? true;

  return (
    <p className="auth-description">
      {forced
        ? "You must change your password before continuing."
        : "Choose a new password. You will be signed out and asked to log in again."}
    </p>
  );
}

async function ChangePasswordContent() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  // Portal accounts have their own flow (portalAccounts table + rate limiting)
  if (session.accountSource === "portal") {
    redirect("/portal/change-password");
  }

  const forced = session.forcePasswordChange ?? false;

  return (
    <>
      <ChangePasswordForm />

      <footer className="auth-footer">
        {forced ? (
          <form action={logoutAction}>
            <button type="submit" className="auth-link">
              Sign out instead
            </button>
          </form>
        ) : (
          <Link
            href={ROLE_LANDING[session.role] ?? "/staff/dashboard"}
            className="auth-link"
          >
            Back to dashboard
          </Link>
        )}
      </footer>
    </>
  );
}

export default function ChangePasswordPage() {
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
              className="w-full h-full object-cover"
            />
          </span>

          <p className="auth-subtitle">Merryland Montessori &amp; High School, Inc.</p>
          <h1 id="change-password-title" className="auth-title">
            Change <span className="auth-title-accent">Password</span>
          </h1>
          {/* Session access is uncached, so the session-aware copy needs its
              own boundary; the static card shell renders immediately. */}
          <Suspense fallback={<Skeleton className="mx-auto mt-2 h-4 w-64" />}>
            <ChangePasswordDescription />
          </Suspense>
          <span className="auth-divider" aria-hidden="true" />
        </header>

        <Suspense fallback={<ChangePasswordFormSkeleton />}>
          <ChangePasswordContent />
        </Suspense>
      </section>
    </main>
  );
}
