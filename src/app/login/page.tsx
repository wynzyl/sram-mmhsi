import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Sign in · SRAMS",
  description: "Sign in to the SRAMS school operations system.",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-grain" aria-hidden="true" />

      <section className="login-card animate-login-rise" aria-labelledby="login-title">
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
          <h1 id="login-title" className="login-title">
            SRAMS <span className="login-title-mark">—</span> Sign in
          </h1>
          <p className="login-subtitle">
            School Registration &amp; Accounts Monitoring System
          </p>
          <span className="login-rule" aria-hidden="true" />
        </header>

        <LoginForm />

        <footer className="login-foot">
          <span>SRAMS v2.1 · Urdaneta City</span>
          <span aria-hidden="true">·</span>
          <span>© MMHSI</span>
        </footer>
      </section>
    </main>
  );
}
