import type { Metadata } from "next";
import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to the SRAMS school operations system.",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh w-full flex-col lg:flex-row">
      <div className="relative min-h-[36vh] w-full shrink-0 overflow-hidden lg:min-h-0 lg:w-1/2 lg:flex-1">
        <Image
          src="/Hero.png"
          alt="Merryland Montessori & High School — Where Excellent Foundation Begins"
          fill
          priority
          className="object-cover object-center"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
      </div>

      <div
        className="flex w-full flex-1 flex-col items-center justify-center gap-8 px-6 py-10 sm:px-10 lg:w-1/2 lg:px-12 lg:py-12"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, var(--color-primary) 4%) 0%, var(--color-surface-2) 100%)",
        }}
      >
        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <div className="flex w-full items-center gap-4">
            <div className="shrink-0">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect width="40" height="40" rx="8" fill="var(--color-primary)" />
                <path
                  d="M10 28 L20 12 L30 28"
                  stroke="var(--color-surface)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 22 H26"
                  stroke="var(--color-surface)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-(--color-text)">
                Merryland Montessori & High School
              </h1>
              <p className="mt-0.5 max-w-[350px] text-sm text-(--color-text-muted)">
                School Registration &amp; Accounts Monitoring System
              </p>
            </div>
          </div>

          <div className="w-full rounded-xl border border-(--color-ops-line) bg-(--color-ops-panel) p-8 shadow-(--shadow-lg)">
            <h2 className="mb-1 font-display text-lg font-bold text-(--color-text)">
              Sign in to your account
            </h2>
            <p className="mb-6 text-sm text-(--color-text-muted)">
              Enter your credentials to access the system.
            </p>

            <LoginForm />

            <p className="mt-5 text-center text-xs text-(--color-text-muted)">
              Having trouble? Contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
