import Image from "next/image";
import { LoginForm } from "@/features/auth";

/**
 * Landing page — split-screen layout with hero image and integrated login form.
 * Authenticated users are redirected by `proxy.ts` to their role dashboard.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left Panel - Hero Section (hidden on mobile) */}
      <div className="relative hidden w-[45%] lg:block">
        {/* Hero Background Image */}
        <Image
          src="/Hero.png"
          alt="Merryland Montessori & High School"
          fill
          priority
          className="object-cover object-center"
        />

        {/* Gradient Overlay for text readability */}
        {/* Photo-legibility scrim: licensed exception to the no-gradient
            rule - it protects text over an image, it is not decoration. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

        {/* Branding Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-10">
          {/* Bottom - Tagline */}
          <h1 className="font-display text-3xl font-semibold leading-tight text-white xl:text-4xl">
            School Registration &<br />
            Account Monitoring System
          </h1>
        </div>
      </div>

      {/* Right Panel - Login Section (theme-aware via auth-page-bg) */}
      <main className="auth-page-bg w-full lg:w-[55%] !min-h-screen">

        <section className="auth-card !border-0 !bg-transparent !shadow-none" aria-labelledby="login-title">
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
    </div>
  );
}
