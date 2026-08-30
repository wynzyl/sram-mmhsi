import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Sign in · SRAMS",
  description: "Sign in to the SRAMS school operations system.",
};

export default function LoginPage() {
  return (
    <main className="auth-page-bg">

      <section className="auth-card" aria-labelledby="login-title">
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
          <h1 id="login-title" className="auth-title">
            SRAMS <span className="auth-title-accent">—</span> Sign in
          </h1>
          <p className="auth-description">
            School Registration &amp; Accounts Monitoring System
          </p>
          <span className="auth-divider" aria-hidden="true" />
        </header>

        <LoginForm />

        <footer className="auth-footer">
          <span>SRAMS v2.1 · Urdaneta City</span>
          <span aria-hidden="true">·</span>
          <span>© MMHSI</span>
        </footer>
      </section>
    </main>
  );
}
