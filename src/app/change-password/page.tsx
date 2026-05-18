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
    <main className="login-page">
      <div className="login-grain" aria-hidden="true" />

      <section className="login-card animate-login-rise" aria-labelledby="change-password-title">
        <header className="login-brand">
          <span className="login-crest" aria-hidden="true">
            <Image
              src="/Hero.png"
              alt=""
              width={56}
              height={56}
              priority
              className="login-crest-img"
            />
          </span>

          <p className="login-eyebrow">Merryland Montessori &amp; High School, Inc.</p>
          <h1 id="change-password-title" className="login-title">
            Change Password
          </h1>
          <p className="login-subtitle">
            You must change your password before continuing.
          </p>
          <span className="login-rule" aria-hidden="true" />
        </header>

        <ChangePasswordForm />

        <footer className="login-foot">
          <form action={logoutAction}>
            <button type="submit" className="login-link">
              Sign out instead
            </button>
          </form>
        </footer>
      </section>
    </main>
  );
}
