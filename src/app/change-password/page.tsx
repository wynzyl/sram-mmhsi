import type { Metadata } from "next";
import Image from "next/image";
import { ChangePasswordForm } from "@/features/auth";
import { logoutAction } from "@/features/auth/auth.actions";

export const metadata: Metadata = {
  title: "Change Password · SRAMS",
  description: "Change your password to continue using SRAMS.",
};

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
          <p className="auth-description">
            You must change your password before continuing.
          </p>
          <span className="auth-divider" aria-hidden="true" />
        </header>

        <ChangePasswordForm />

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
