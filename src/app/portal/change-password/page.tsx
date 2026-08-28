import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { PortalChangePasswordForm } from "@/features/portal-accounts/components/PortalChangePasswordForm";
import { logoutAction } from "@/features/auth/auth.actions";

export const metadata: Metadata = {
  title: "Change Password · Student Portal",
  description: "Change your password to continue using the Student Portal.",
};

/**
 * Force password change page for portal users.
 *
 * This page handles the intermediate state where a user is authenticated
 * but must change their password before accessing the portal.
 *
 * Note: Cannot use requirePortalSession() here because it would redirect
 * to login, but the user IS logged in — they just need to change their password.
 */
export default async function PortalChangePasswordPage() {
  const session = await getCurrentSession();

  // Ensure user is logged in as a portal user
  if (!session || session.accountSource !== "portal" || !session.studentId) {
    redirect("/login");
  }

  // If password change is not required, redirect to dashboard
  if (!session.forcePasswordChange) {
    redirect("/portal/dashboard");
  }

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
              className="w-full h-full object-cover"
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

        <PortalChangePasswordForm />

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
